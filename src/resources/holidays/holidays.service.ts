import { HttpException, HttpStatus, Injectable} from "@nestjs/common";
import { HolidaysDtoRequest } from "./holidays.dto";
import { DayEntityService } from "src/models/day/day.service";
import { CallendarService } from "src/integrations/holiday_callendar_api/callendar.service";
import { CountryEntityService } from "src/models/country/country.service";
import { ErrorService as es } from "src/errors/adderror.service";
import {IHolidaysRequestError} from "./holidays.interface";
import { map, Observable, tap } from "rxjs";
import { IMonthsObject } from "src/utilities/descriptor.interface";
import { ICountry } from "src/integrations/holiday_callendar_api/callendar.interface";
import { CacherService } from "src/cacher/cacher.service";
import { CallendarPrepareService } from "src/integrations/holiday_callendar_api/data_prepare/prepdays.service";
import { DateLimitsThrowingService } from "src/utilities/throwers/date_limits/date_limits.service";
import { StatusOfDayResourceService } from "../status/status.service";



@Injectable()
export class HolidaysResourceService {
    constructor(
        private readonly callendarService: CallendarService,
        private readonly countryEntityService: CountryEntityService,
        private readonly dayEntityService: DayEntityService,
        private readonly cacherService: CacherService,
        private readonly callPrepService: CallendarPrepareService,
        private readonly dateLimitsThrowService: DateLimitsThrowingService,
        private readonly statusOfDayResourceService: StatusOfDayResourceService
    ) {}

    /**
     * Validates the request data
     * @param req 
     * @returns req 
     * @throws HttpException if not meeting
     */
    validateRequest(req: HolidaysDtoRequest) {
        let errorMessages: string[] = [];
        if (req.country_code == undefined && req.country_name == undefined) {
            errorMessages.push("country_code or country_name are required");
        }
        if (req.year == undefined) {
            errorMessages.push("year is required")
        }
        if (errorMessages.length > 0) {
            if (errorMessages.length == 1) {
                throw new HttpException({"code": 400, "message": errorMessages[1], "error": "Bad Request"}, HttpStatus.BAD_REQUEST)
            } else throw new HttpException({"code": 400, "message": errorMessages, "error": "Bad Request"}, HttpStatus.BAD_REQUEST)
        }

        let e: IHolidaysRequestError = new Object();
        if (req.country_code != undefined) {
            if (req.country_code.length != 3) {
                e.country_code = es.addError(e.country_code, "can only be 3 characters long")
            }
            if (/[^a-zA-Z]/.test(req.country_code)) {
                e.country_code = es.addError(e.country_code, "can only be characters")
            }
        }
        if (req.region_code != undefined) {
            if (req.region_code.length != 2 && req.region_code.length != 3) {
                e.region_code = es.addError(e.region_code, "can only be 2-3 characters long")
            }
            if (/[^a-zA-Z ]/.test(req.region_code)) {
                e.region_code = es.addError(e.region_code, "can only be characters")
            }
        }
        if (req.country_name != undefined) {
            if (!(req.country_name.length > 2 && req.country_name.length < 32)) {
                e.country_name = es.addError(e.country_name, "can only be 2-32 characters long")
            }
            if (/[^a-zA-Z]/.test(req.country_name)) {
                e.country_name = es.addError(e.country_name, "can only be characters")
            }
        }
        if (req.year > 32767 || req.year < 0) {
            e.year = es.addError(e.year, "number can only be the size of smallint unsigned (0-32767)")
        } 

        if (Object.entries(e).length === 0) {
            return req
        } else {
            throw new HttpException({"code": 400, "message": e, "error": "Bad Request"}, HttpStatus.BAD_REQUEST)
        }
    }

    /**
     * Prepares days from the third-party API.
     * 
     * @returns data about:
     * - boolean on were the days found (no days, but country found)
     * - prepared result to return to user
     * - unserialized days array (obtained originally)
     * 
     * @param country_code 
     * @param year 
     * @param region_code
     */
    prepareHolidaysFromCallendar(country_code: string, year: number, region_code?: string) {
        return this.callendarService.getHolidaysForYear(country_code, year, region_code)
            .pipe(
                map(days => {
                    let containing_days = true;
                    if (days.length == 0) {
                        containing_days = false;
                    }
                    let res = this.dayEntityService
                    .prepareHolidaysFromCallendarToResponse(days)
                        .then(result => {return {containing_days, result, days}});
                    return res;
                })
            )
    }

    /**
     * Finds country code, using country name from the user request, by using countries list from the third-party response
     * @param req 
     * @param countries_response 
     * @returns country code
     * @throws HttpException if country with given name was not found
     */
    async findCountryCodeUsingResponse(req: HolidaysDtoRequest, countries_response: ICountry[]) {
        let country_code: string = undefined;
        if (req.country_code == undefined && req.country_name != undefined) {
            // only has country name , try to find by code from API
            
            let country_name_lower = req.country_name.toLowerCase();

            for (let i=0; i<countries_response.length; i++) {
                if (countries_response[i].fullName.toLowerCase() == country_name_lower) {
                    country_code = countries_response[i].countryCode;
                    break;
                }
            }
                
            if (country_code == undefined) {
                throw new HttpException({
                    "code": 404,
                    "message": "No country was found following specified name",
                    "error": "Not Found"
                }, HttpStatus.NOT_FOUND);
            }
            
        } else {
            country_code = req.country_code;
        }
        return country_code;
    }

    /**
     * #### Serves holiday days list that of requested.
     * 
     * Based on the config (hotload) api call will be made to collect data from the api,
     * before the data is checked in the database.
     * 
     * Making two requests to the database:
     * - to get ALL days of requested year
     * - country with its region ids (and region requested)
     * 
     * Response will be produced based on:
     * - is country or any country were found (use third-party API if no country found)
     * - is saved country dates limits are met (if requested doesn't meet throw HttpException)
     * - is country or region already has requested year days cached from database response. 
     * If no year found, then take data from third-party API
     * 
     * If found that year is (cached) saved in the database, then filter out days that are not holiday 
     * for requested country (and region)
     * 
     * For both database days and third-party API days allocate each day to specified month from 1st to 12nd to
     * return as an array of months with days in each months (if no days found, return empty month array list)
     * 
     * Days that are found from the API are saved or updated to the database.
     * Country or region that are found are saved to the database (it will create or update new countries), 
     * found days are saved with that new country_id or region_id.
     * 
     * It DOES NOT clear region or country id from day's none_in.. lists
     * 
     * @param req
     * @returns 
     * @throws HttpException
     */
    async serveHolidaysList(req: HolidaysDtoRequest): 
    Promise<
        IMonthsObject[] | 
        Observable<Promise<IMonthsObject[]>>
    > {

        let db_days_promise = this.dayEntityService.findByYear(
            req.year
        );
        let db_country_ryi = await 
            this.countryEntityService.findByWithRegions(
                req.country_name, 
                req.country_code, 
                req.region_code
            );

        // If hotload is on, this will prepare holidays for each month from the API.
        // This can be served in case no data in the database.
        let response_holidays_try = this.callPrepService.tryHotLoadHolidayDays({
            db_country_ryi,
            req,
            hotload: true
        });
        
        let isYear: {
            country_year_found: boolean;
            region_year_found: boolean;
        } = undefined;

        let db_days = await db_days_promise;
        db_days_promise = null

        // let db_country_ryi = await this.countryEntityService.findByWithRegions(req.country_name, req.country_code, req.region_code);
        if (db_country_ryi != null) {
            this.dateLimitsThrowService.tryThrowYearLimits(
                db_country_ryi.starting_date,
                db_country_ryi.ending_date,
                req.year
            );

            

            if (db_days.length != 0) {
                // country was found
                // days were also found

                // find out if days found is enough
                isYear = this.callPrepService.isYearOfDayCached(
                    req.year,
                    db_country_ryi.country_years,
                    db_country_ryi.region_years
                );

                if (isYear.country_year_found == true || 
                    isYear.region_year_found == true) {
                    
                        // all days must be with country_id
                    // prepare found days to the response and return
                    return await this.dayEntityService
                    .prepareHolidaysFromDatabaseToResponse(
                        db_days, 
                        db_country_ryi.country_id, 
                        db_country_ryi.region_id
                    );
                }
            }
        }

        // days in the database were not found to be enough or none found
        // address hotloaded values or call them if they were not called
        let tryLoadDay = (await response_holidays_try != null)?
            (await response_holidays_try)
            : await (this.callPrepService.tryLoadHolidayDays({
                req,
                db_country_ryi,
                hotload: false
            }));
        
        // check for error, maybe that there's no country with such code, 
        // date limits are reached or no such requested region
        // + additionally save new or updated countries found 
        // if request was with country_name instead of country_code
        if (tryLoadDay.error != undefined) {
            return this.statusOfDayResourceService.throwErrorFromResponse(tryLoadDay);
        }

        
        return tryLoadDay.prep_obs.pipe(
            tap(async prep_promise => {
                let prepared_data = await prep_promise;

                // if db_days or rp_days are empty arrays won't do anything
                // however if they are undefined, will try to make a request
                // to either t-p API or database
                await this.cacherService.cacheAroundDays({
                    country_name: req.country_name,
                    country_code: req.country_code,
                    region_code: req.region_code,
                    db_country_ryi: db_country_ryi,
                    year: req.year,
                    db_days: db_days,
                    rp_days: prepared_data.days,
                    countries_update_promise: tryLoadDay.countries_update_promise
                })
            }),
            map(async prep_promise => {
                // return either prepared list of months with days
                // or throw an error
                let prepared_data = await prep_promise;
                
                if (prepared_data.containing_days == true) {
                    return prepared_data.result
                }

                let message: string = (db_country_ryi.region_code != undefined)?
                    "Can't find holidays for a year to specified country and region"
                :   "Can't find holidays for a year to specified country";
                
                throw new HttpException({
                    code: 404,
                    message: message,
                    error: "Not Found"
                }, HttpStatus.NOT_FOUND);
            })
        );
    }
}
import { HttpException, HttpStatus, Injectable} from "@nestjs/common";
import { HolidaysDtoRequest } from "./holidays.dto";
import { DayEntityService } from "src/models/day/day.service";
import { CallendarService } from "src/integrations/holiday_callendar_api/callendar.service";
import { CountryEntityService } from "src/models/country/country.service";
import { ErrorService as es } from "src/errors/adderror.service";
import {IHolidaysRequestError} from "./holidays.interface";
import { ConfigService } from "src/config/config.service";
import { lastValueFrom, map, Observable, tap } from "rxjs";
import { IMonthsObject } from "src/utilities/descriptor.interface";
import { ICountry, IDay } from "src/integrations/holiday_callendar_api/callendar.interface";
import { CacherService } from "src/cacher/cacher.service";
import { ICountryEntityWithRegions } from "src/models/country/country.interface";



@Injectable()
export class HolidaysResourceService {
    constructor(
        private readonly callendarService: CallendarService,
        private readonly countryEntityService: CountryEntityService,
        private readonly configService: ConfigService,
        private readonly dayEntityService: DayEntityService,
        private readonly cacherService: CacherService
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
        let country_code = undefined;
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
     * Tries to throw if found in the database country date limits don't meet dates from request
     * 
     * @param country_database 
     * @param req
     * @throws HttpException with least or most available year for the country
     */
    tryThrowYearLimits(country_database: ICountryEntityWithRegions, req: HolidaysDtoRequest) {
        if (country_database.starting_date.year > req.year) {
            if (country_database.starting_date.month != 1 && country_database.starting_date.day != 1) {
                throw new HttpException({ "code": 400, "error": {year: "least available is"+(country_database.starting_date.year+1)} }, HttpStatus.BAD_REQUEST);
            } else {
                throw new HttpException({ "code": 400, "error": {year: "least available is"+country_database.starting_date.year} }, HttpStatus.BAD_REQUEST);
            }
        } else if (country_database.starting_date.year == req.year) {
            if (country_database.starting_date.month != 1 && country_database.starting_date.day != 1) {
                throw new HttpException({ "code": 400, "error": {year: "least available is"+(country_database.starting_date.year+1)} }, HttpStatus.BAD_REQUEST);
            }
        } else if (country_database.ending_date.year < req.year) {
            if (country_database.ending_date.month != 1 && country_database.ending_date.day != 1) {
                throw new HttpException({ "code": 400, "error": {year: "most available is"+(country_database.ending_date.year-1)} }, HttpStatus.BAD_REQUEST);
            } else {
                throw new HttpException({ "code": 400, "error": {year: "most available is"+(country_database.ending_date.year)} }, HttpStatus.BAD_REQUEST);
            }
        } else if (country_database.ending_date.year == req.year) {
            if (country_database.ending_date.month != 1 && country_database.ending_date.day != 1) {
                throw new HttpException({ "code": 400, "error": {year: "most available is"+(country_database.ending_date.year-1)} }, HttpStatus.BAD_REQUEST);
            }
        }
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
     * 
     * @param req
     * @returns 
     * @throws HttpException
     */
    async serveHolidaysList(req: HolidaysDtoRequest): Promise<IMonthsObject[] | Observable<IMonthsObject[]>> {

        let daysForThisYear = this.dayEntityService.findByYear(req.year);

        // If hotload is on, this will prepare holidays for each month from the API.
        // This can be served in case no data in the database.
        let holidayDaysListFromAPI = this.configService.getConfig().then(
            cfg => {
                let hotload: boolean = (cfg.settings.hotload);
                if (cfg.settings.hotload) {
                    if (req.country_code == undefined) {
                        // true, undefined
                        return {
                            "hotload": hotload, 
                            "list": null
                        };
                    } else {
                        let res = this.prepareHolidaysFromCallendar(req.country_code, req.year, req.region_code);
                        return {
                            "hotload": hotload, 
                            "list": res
                        };
                    }
                    
                } else {
                    // false, undefined
                    return {
                        "hotload": hotload, 
                        "list": null
                    };
                }
            }
        );
        
        


        let country_database = await this.countryEntityService.findByWithRegions(req.country_name, req.country_code, req.region_code);
        

        if (country_database == null) {
            // no country and/or region were found in the database
            let countries_response = await lastValueFrom(this.callendarService.getCountries());
            let country_code = await this.findCountryCodeUsingResponse(req, countries_response);
                
                    
            let days_response = await lastValueFrom(this.callendarService.getHolidaysForYear(country_code, req.year, req.region_code));

            if (days_response.length == 0) {
                throw new HttpException({
                    "code": 404,
                    "message": "No holidays were found following specified country name",
                    "error": "Not Found"
                }, HttpStatus.NOT_FOUND);
            } else {

                let holidaysOfMonths = await this.dayEntityService.prepareHolidaysFromCallendarToResponse(days_response);
                
                let obs = new Observable((o) => {
                    o.next(holidaysOfMonths);
                    o.complete();
                });
                return obs.pipe(tap(async ()=> {
                    // DO CACHE TO DATABASE>
                    await this.cacherService.cache_around_days(
                        countries_response, country_code, req.region_code, req.year, daysForThisYear
                    );
                }),
                map((x:IMonthsObject[])=> {
                    return x
                }));
            }
        } else {
            // country with regions was found.
            // country code must be defined
            this.tryThrowYearLimits(country_database, req);

            let days_are_in_database = false;
            
            if (country_database.region_years != undefined) {
                // region provided    
                if (country_database.region_years != null) {
                for (let i=0; country_database.region_years.length; i++) {
                    if (country_database.region_years[i] == req.year) {
                        days_are_in_database = true;
                        break;
                    }
                }} else {
                    // no years in region_years
                }
                
            }
            if (!days_are_in_database) {
                if (country_database.country_years != null) {
                for (let i=0; i<country_database.country_years.length; i++) {
                    if (country_database.country_years[i] == req.year) {
                        days_are_in_database = true;
                    }
                }} else {
                    // no years in country_years
                }
                
            }

            if (days_are_in_database) {

                // make a request to the database 
                return await this.dayEntityService.prepareHolidaysFromDatabaseToResponse(
                    (await daysForThisYear), country_database.country_id, country_database.region_id
                );
                
                // return false;
                
            } else {
                // use hotloaded values from api.
                let res_list_obs: Observable<Promise<{
                    containing_days: boolean;
                    result: IMonthsObject[];
                    days: IDay[];
                }>> = undefined;

                if (req.country_code != undefined) {
                    let hotloaded = await holidayDaysListFromAPI;

                    if (hotloaded.hotload == true) {
                        // values were loaded.
                        res_list_obs = hotloaded.list;
                    } else {
                        res_list_obs = this.prepareHolidaysFromCallendar(country_database.country_code, req.year, country_database.region_code);
                    }
                } else {
                    res_list_obs = this.prepareHolidaysFromCallendar(country_database.country_code, req.year, country_database.region_code);
                }
                

                
                


                if (res_list_obs != null) {
                    let res_list = await lastValueFrom(res_list_obs);
                    let obs = new Observable((o) => {
                        o.next(res_list);
                        o.complete();
                    });

                    return obs.pipe(
                    tap(async () => {
                        await this.cacherService.cache_around_days(
                            undefined, country_database.country_code, country_database.region_code, req.year, daysForThisYear
                        )
                    }), 
                    map((x: {containing_days: boolean, result: IMonthsObject[], days: IDay[]}) => {

                        if (x.containing_days == true) {
                            return x.result;
                        } else {
                            let message: string;
                            if (country_database.region_code != undefined) {
                                message = "Can't find holidays for a year to specified country and region";
                            } else {
                                message = "Can't find holidays for a year to specified country";
                            }
                            
                            let err = new HttpException({
                                "code": 404,
                                "message": message,
                                "error": "Not Found"
                            }, HttpStatus.NOT_FOUND)
                            throw err
                        }
                    }));

                } else {
                    let message: string;
                    if (country_database.region_code != undefined) {
                        message = "Can't find holidays for a year to specified country and region";
                    } else {
                        message = "Can't find holidays for a year to specified country";
                    }
                    
                    let err = new HttpException({
                        "code": 404,
                        "message": message,
                        "error": "Not Found"
                    }, HttpStatus.NOT_FOUND)
                    throw err
                }

            }
            
                    
        }
    }
}
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CallendarService } from 'src/integrations/holiday_callendar_api/callendar.service';
import { CountryEntityService } from 'src/models/country/country.service';
import { StatusDtoRequest } from './status.dto';
import { IDayStatusDate, IStatusOfDayRequestError } from './status.interface';
import { ErrorService as es } from "src/errors/adderror.service";
import { DayEntityService } from 'src/models/day/day.service';
import { lastValueFrom, map, Observable, tap } from 'rxjs';
import { Country } from 'src/models/country/country.entity';
import { Region } from 'src/models/region/region.entity';
import { IDay } from 'src/integrations/holiday_callendar_api/callendar.interface';
import { Day } from 'src/models/day/day.entity';
import {DayStatus} from './status.type';
import { WeekDaysEnum } from 'src/utilities/days.enum';
import { DaysInMonthsService } from 'src/utilities/dim.service';
import { CacherService } from 'src/cacher/cacher.service';
import { ICountryEntityWithRegions, ISimpleDate } from 'src/models/country/country.interface';
import { DateLimitsThrowingService } from 'src/utilities/throwers/date_limits/date_limits.service';
import { CallendarPrepareService } from 'src/integrations/holiday_callendar_api/data_prepare/prepdays.service';
import { ListingService } from 'src/utilities/listing.service';


@Injectable()
export class StatusOfDayResourceService {
    constructor(
        private readonly dayEntityService: DayEntityService,
        private readonly callendarService: CallendarService,
        private readonly countryEntityService: CountryEntityService,
        private readonly dimService: DaysInMonthsService,
        private readonly cacherService: CacherService,
        private readonly callPrepService: CallendarPrepareService,
        private readonly dateLimitsThrowService: DateLimitsThrowingService,
        private readonly ls: ListingService
    ) {}

    /**
     * Validates the request data
     * @param req 
     * @returns 
     */
    validateRequest(req: StatusDtoRequest) {
        let e: IStatusOfDayRequestError = new Object();

        if (req.country_code == undefined && req.country_name == undefined) {
            e.country_name = es.addError(e.country_name, "required or use country_code");
            e.country_code = es.addError(e.country_code, "required or use country_name");
        }

        if (req.year == undefined) {
            e.year = es.addError(e.year, "required");
        }
        if (req.month == undefined) {
            e.month = es.addError(e.month, "required");
        }
        if (req.day == undefined) {
            e.day = es.addError(e.day, "required");
        }

        if (Object.entries(e).length !== 0) {
            throw new HttpException({ "code": 400, "message": e, "error": "Bad Request" }, HttpStatus.BAD_REQUEST)
        }

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

        if (req.month > 12 || req.month <= 0) {
            e.month = es.addError(e.month, "number can only be from 1 to 12");
        }

        if (e.month == undefined) {
            let days_in_month = this.dimService.getDaysAmmountsForYearAndMonth(req.year, req.month);
            if (req.day > days_in_month || req.day <= 0) {
                e.day = es.addError(e.day, "number for requested month can only be from 1 to" + days_in_month)
            }
        }

        if (Object.entries(e).length === 0) {
            return req
        } else {
            throw new HttpException({ "code": 400, "message": e, "error": "Bad Request" }, HttpStatus.BAD_REQUEST)
        }
    }

    /**
     * Creates the response to the desired format
     * 
     * Finds the day week day and status if unknown
     * @param day 
     * @param status 
     * @returns prepared response
     */
    createResponse(day: IDayStatusDate, status: DayStatus) {
        let dateFormat = new Date(Date.UTC(day.year, (day.month-1), day.day));
        let week_day_number = dateFormat.getDay();
        week_day_number = week_day_number ? week_day_number: 7;
        if (status == 'unknown') {
            if (week_day_number > 4) {
                status = 'freeday'
            } else {
                status = 'workday'
            }
        }
        return {
            "date": {
                "day": Number(day.day),
                "month": Number(day.month),
                "year": Number(day.year),
                "week_day_number": week_day_number,
                "week_day": WeekDaysEnum[week_day_number],
                "to_date": dateFormat.toISOString()
            },
            "status": status
        }
    }

    /**
     * Tries to find the day status by checking region_id in any day's lists
     * 
     * By default checks only holiday_in_regions and workday_in_regions lists
     * 
     * @param day_database 
     * @param region_id 
     * @param workdays_in if country has extra working days, check by workdays_in_regions
     * @param with_none check all lists (none_in_regions, holiday_in_regions and workday_in_regions (in order)) if true
     * @param only_none check only none_in_regions if true
     * @returns prepared response or undefined if not found
     */
    checkRegionInLists(
        day_database: Day, 
        region_id: number, 
        workdays_in: boolean, 
        with_none?: boolean, 
        only_none?: boolean
    ) {
        if (only_none != undefined) {
            if (only_none) {
                if (this.ls.doesListContainValue(day_database.none_in_regions_ids, region_id)) {
                    return this.createResponse(day_database, 'unknown');
                }
                return undefined;
            }
        }
        if (this.ls.doesListContainValue(day_database.holiday_in_regions_ids, region_id)) {
            return this.createResponse(day_database, 'holiday');
        }
        
        if (workdays_in)
        if (this.ls.doesListContainValue(day_database.workday_in_regions_ids, region_id)) {
            return this.createResponse(day_database, 'workday');
        }
        
        if (with_none != undefined) {
            if (with_none) {
                if (this.ls.doesListContainValue(day_database.none_in_regions_ids, region_id)) {
                    return this.createResponse(day_database, 'unknown');
                }
                return undefined;
            }
        }
        return undefined;
    }

    /**
     * Tries to find the day status by checking country_id in any day's lists
     * 
     * By default checks only holiday_in_countries and workday_in_countries lists
     * 
     * @param day_database 
     * @param country_id 
     * @param workdays_in if country has extra working days, check by workdays_in_countries
     * @param with_none check all lists (none_in_countries, holiday_in_countries and workday_in_countries (in order)) if true
     * @param only_none check only none_in_countries if true
     * @returns prepared response
     */
    checkCountryLists (day_database: Day, country_id: number, workdays_in: boolean, with_none?: boolean, only_none?: boolean) {
        if (only_none != undefined) {
            if (only_none) {
                if (this.ls.doesListContainValue(day_database.none_in_countries_ids, country_id)) {
                    return this.createResponse(day_database, 'unknown');
                }
                
                return undefined;
            }
        }

        if (workdays_in)
        if (this.ls.doesListContainValue(day_database.holiday_in_countries_ids, country_id)) {
            return this.createResponse(day_database, 'holiday');
        }
        
        if (this.ls.doesListContainValue(day_database.workday_in_countries_ids, country_id)) {
            return this.createResponse(day_database, 'workday');
        }
        
        if (with_none != undefined) {
            if (with_none) {
                if (this.ls.doesListContainValue(day_database.none_in_countries_ids, country_id)) {
                    return this.createResponse(day_database, 'unknown');
                }
                return undefined;
            }
        }
        return undefined;
    }


    /**
     * Tries to find the day status
     * 
     * Checks by the cached year of country or region
     * 
     * Based on the signals (cached year or region_id) check by country or by region 
     * and country until identified not found
     * 
     * If region_year_found or region_id not undefined, check by region first.
     * 
     * @param day_database 
     * @param db_country_id
     * @param country_year_found shows if country has requested year days all in the database
     * @param region_year_found if region was requested, this might be true, if not it is always false
     * @param region_id the requested region_id. In addition to checking by country first, check by region if not found sufficient.
     * @param with_none check by all lists by country_id (or region_id)
     * @param only_none check only none_in_countries if true
     * @returns prepared response or undefined if day not found
     */
    whatDayStatus( 
        day_database: Day, 
        db_country_id: number, 
        db_country_workdays: boolean, 
        country_year_found: boolean, 
        region_year_found: boolean,
        region_id?: number, 
        with_none?: boolean, 
        only_none?: boolean
    ) {
        
        // shortcut if year is cached
        if (country_year_found) {
            // day is cached
            let res = this.checkCountryLists(day_database, db_country_id, db_country_workdays);
            if (res == undefined) {
                return this.createResponse(day_database, 'unknown');
            } else return res;
        }
        if (region_year_found) {
            // day is cached, region_id is guaranteed to contain
            let res = this.checkRegionInLists(day_database, region_id, db_country_workdays);
            if (res == undefined) {

                // a day can have country_id instead of all region_id's under one list
                res = this.checkCountryLists(day_database, db_country_id, db_country_workdays);
                if (res == undefined) {
                    return this.createResponse(day_database, 'unknown');
                } else return res;

            } else return res
        }


        if (region_id != undefined) {
            let res = this.checkRegionInLists(day_database, region_id, db_country_workdays, with_none, only_none);
            if (res != undefined) {
                return res;
            }
        }

        let res = this.checkCountryLists(day_database, db_country_id, db_country_workdays, with_none, only_none);
        if (res != undefined) {
            return res
        }

        // day is not found
        return undefined;
    }

    /**
     * Must be used when error is found.
     * 
     * If countries were found required to update, update them by
     * returning observable with HttpException and await countries_update_promise,
     * else throws the same HttpException as in Observable.
     * 
     * @param tryLoadDay contains any error and a promise to save/update countries and regions
     * @returns HttpException if error found or null if it wasn't 
     * @throws HttpException
     */
    throwErrorFromResponse (tryLoadDay: {
        error: any,
        countries_update_promise: Promise<void> | Promise<{
            savedCountries: Country[];
            savedRegions: Region[];
        }>
    }) {
        
        if (tryLoadDay.countries_update_promise != undefined) {
            let exception = new HttpException({ "code": 400, "error": tryLoadDay.error }, HttpStatus.BAD_REQUEST);
            let obs: Observable<HttpException> = new Observable((o) => {
                o.next(exception);
                o.complete();
            });
            return obs.pipe(tap(async ()=> {
                // execute update promise before throwing
                if (tryLoadDay.countries_update_promise != undefined) {
                    await tryLoadDay.countries_update_promise;
                }
            }),
            map(e=> {
                throw e;
            }));

        } else throw new HttpException({ "code": 404, "message": tryLoadDay.error, "error": "Not Found" }, HttpStatus.NOT_FOUND);
        
    }


    /**
     * Serves the day status
     * 
     * Tries to find country (with region) and requested day
     * 
     * If hotload is enabled, will send request to the third-party API to get the day from request
     * 
     * Checks found country (or region) to have days saved for requested year + finds region_id
     * 
     * Based on the data in the database, either present day status in the response or 
     * present the data from third-party API in last case, saving the day.
     * 
     * If the country or region were not present, creates country/region first before assigning its ids to the day.
     * 
     * Updates the day with newly found country/region.
     * 
     * If the day was checked by every country/region, then it is absolute and none_in... lists are ignored.
     * 
     * 
     * @param req 
     * @returns 
     * @throws HttpException
     */
    async serveDayStatus(req: StatusDtoRequest) {
        /**
         * Identifies if all days for requested are saved, under region or country. 
         */
        let isYear: {
            country_year_found: boolean;
            region_year_found: boolean;
        } = undefined;


        let db_day_promise = this.dayEntityService.find_by_date(
            req.year, 
            req.month, 
            req.day
        );
        
        /**
         * Finds country from the database, if region requested its id will be already included
         */
        let db_country_ryi: ICountryEntityWithRegions = await 
            this.countryEntityService.findByWithRegions(
                req.country_name, 
                req.country_code, 
                req.region_code
            );

        
        
        // will return day if database doesn't have that day for specified country and region.
        // if cached year is found in either region or country, will return true in which found
        // if no country was found, will return update observable promise, that must be awaited, together with day found.
        // day must be cached, depending on whether or not day in the database was found.
        // day found can be empty array
        let response_day_try = this.callPrepService.tryHotLoadDays({
            req,
            db_country_ryi,
            hotload: true
        });

        let db_day = await db_day_promise;
        db_day_promise = null

        if (db_country_ryi != undefined) {
            
            this.dateLimitsThrowService.tryThrowDatesLimits(
                db_country_ryi.starting_date,
                db_country_ryi.ending_date,
                req
            );
            
            isYear = this.callPrepService.isYearOfDayCached(
                req.year,
                db_country_ryi.country_years,
                db_country_ryi.region_years
            );

            if (db_day != undefined) {
                // day found

                // this day was cached by every region and country, no need to check by none_in... array
                let res = this.whatDayStatus(
                    db_day,
                    db_country_ryi.country_id,
                    db_country_ryi.workdays,
                    isYear.country_year_found,
                    isYear.region_year_found,
                    db_country_ryi.region_id,
                    // based on absolute will or will not check with_none...
                    !db_day.absolute
                );

                if (res != undefined) {
                    return res;
                } else if (db_day.absolute) {
                    return this.createResponse(db_day, 'unknown');
                }
                
                
            }

            // day wasn't found, maybe because it was never saved
            if (isYear.country_year_found == true || isYear.region_year_found == true) {
                return this.createResponse(req, 'unknown');
            }

            // day could have been found, but no country_id or region_id found --> update
            // day could have been not found, country doesn't have cached days --> create
            
        }


        let tryLoadDay = (await response_day_try != null)?
            (await response_day_try)
        : await (this.callPrepService.tryLoadDays({
            req,
            db_country_ryi,
            hotload: false
        }));


        if (tryLoadDay.error != undefined) {
            return this.throwErrorFromResponse(tryLoadDay)
        }

        // at this point day_obs must not be undefined 
        
        // previously noted that there might be a data race: 
        // "(unless there's a data race and the day appeared after it was 
        // not found by date)"
        
        // there're can be a data race, but different, 
        // because days are updated first and then country is updated,
        // in worst case scenario there will be no region or country year 
        // found,
        // but there will be day, which must have been returned already

        // and even if there would be such scenario, there's no need 
        // to return an error to user instead of viable response
        // from third-party API
        

        return ((tryLoadDay.days_obs) as Observable<IDay[]>).pipe(
            tap(async (days: IDay[]) => {

                /**Day obtained from response*/
                let rp_day = (days.length == 0) ?
                    null
                :   days[0];

                if (db_day == undefined) {
                    if (db_country_ryi == undefined) {
                        // create all countries and obtain country id and region id
                        // create new day.
                        let rp_countries = await lastValueFrom(this.callendarService.getCountries());
                        
                        // creates rp_day for new country using its id
                        // can update countries in promise and gets requested country from database
                        await this.cacherService.cacheAroundDays({
                            // updating countries from t-p API. not found in database
                            rp_countries,
                            country_code: req.country_code,
                            country_name: req.country_name,
                            year: req.year,
                            region_code: req.country_code,
                            // day from response, can be null (will be saved or udpated even if null)
                            rp_days: [rp_day],
                            // countries might require an update
                            countries_update_promise: tryLoadDay.countries_update_promise,
                            // identifying the operation is only for one day
                            operation_for_one_day: true,
                            // specifying date_requested to update day
                            date_requested: req,
                        });
                    } else {
                        // db_country entity must exist, because  day was found using its id
                        await this.dayEntityService.createOneDayFromResponse(
                            rp_day, 
                            req,
                            db_country_ryi.country_id,
                            db_country_ryi.region_id
                        );
                    }
                } else {
                    if (db_country_ryi != undefined) {
                        await this.dayEntityService.updateOneDayFromResponse(
                            rp_day, 
                            db_day,
                            db_country_ryi.country_id,
                            db_country_ryi.regions,
                            db_country_ryi.country_years,
                            db_country_ryi.region_id
                        );
                    } else {

                        let rp_countries = await lastValueFrom(this.callendarService.getCountries());
                        
                        // updating day in the database here
                        await this.cacherService.cacheAroundDays({
                            // updating countries from t-p API. not found in database
                            rp_countries,
                            country_code: req.country_code,
                            country_name: req.country_name,
                            year: req.year,
                            region_code: req.country_code,
                            // day from response, can be null (will be saved or udpated even if null)
                            rp_days: [rp_day],
                            // countries might require an update
                            countries_update_promise: tryLoadDay.countries_update_promise,
                            // identifying the operation is only for one day
                            operation_for_one_day: true,
                            db_day_for_one_day: db_day
                        });
                    }
                    
                }
            }),
            map(day => {
                if (day.length == 0) {
                    return this.createResponse(req, 'unknown');
                } else {
                    if (day[0].holidayType == 'public_holiday') {
                        return this.createResponse(req, 'holiday');
                    } else {
                        return this.createResponse(req, 'workday');
                    }
                }
            })
        );
    }
}
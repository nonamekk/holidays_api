import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CallendarService } from 'src/integrations/holiday_callendar_api/callendar.service';
import { CountryEntityService } from 'src/models/country/country.service';
import { StatusDtoRequest } from './status.dto';
import { IDayStatusDate, IStatusOfDayRequestError } from './status.interface';
import { ErrorService as es } from "src/errors/adderror.service";
import { DayEntityService } from 'src/models/day/day.service';
import { ConfigService } from 'src/config/config.service';
import { lastValueFrom, map, Observable, tap } from 'rxjs';
import { Country } from 'src/models/country/country.entity';
import { Region } from 'src/models/region/region.entity';
import { IDay } from 'src/integrations/holiday_callendar_api/callendar.interface';
import { Day } from 'src/models/day/day.entity';
import {DayStatus} from './status.type';
import { WeekDaysEnum } from 'src/utilities/days.enum';
import { DaysInMonthsService } from 'src/utilities/dim.service';
import { HolidaysDtoRequest } from '../holidays/holidays.dto';


@Injectable()
export class StatusOfDayResourceService {
    constructor(
        private readonly dayEntityService: DayEntityService,
        private readonly configService: ConfigService,
        private readonly callendarService: CallendarService,
        private readonly countryEntityService: CountryEntityService,
        private readonly dimService: DaysInMonthsService
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

    throwBeforeError(country: Country) {
        throw new HttpException({ 
            "code": 400, 
            "error": {
                date: {
                    year: country.from_date_year,
                    month: country.from_date_month,
                    day: country.from_date_day
                }
            },
            "message": "Dates before are not supported"
        }, HttpStatus.BAD_REQUEST);
    }

    throwAfterError(country: Country) {
        throw new HttpException({ 
            "code": 400, 
            "error": {
                date: {
                    year: country.to_date_year,
                    month: country.to_date_month,
                    day: country.to_date_day
                }
            },
            "message": "Dates after are not supported"
        }, HttpStatus.BAD_REQUEST);
    }

    tryThrowCountryDateLimits(country: Country, req: StatusDtoRequest) {
        if (country.from_date_year > req.year) {
            this.throwBeforeError(country);

        } else if (country.from_date_year == req.year) {
            if (country.from_date_month > req.month) {
                this.throwBeforeError(country)
            } else if (country.from_date_month == req.month) {
                if (country.from_date_day > req.day) {
                    this.throwBeforeError(country);
                }
            }

        } else if (country.to_date_year < req.year) {
            this.throwAfterError(country);
        } else if (country.to_date_year == req.year) {
            
            if (country.from_date_month < req.month) {
                this.throwBeforeError(country)
            } else if (country.from_date_month == req.month) {
                if (country.from_date_day < req.day) {
                    this.throwBeforeError(country);
                }
            }
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
    checkRegionInLists (day_database: Day, region_id: number, workdays_in: boolean, with_none?: boolean, only_none?: boolean) {
        if (only_none != undefined) {
            if (only_none) {
                if (day_database.none_in_regions_ids != null) {
                    for (let i=0; i<day_database.none_in_regions_ids.length; i++) {
                        if (day_database.none_in_regions_ids[i] == region_id) {
                            // the day is holiday
                            return this.createResponse(day_database, 'unknown');
                        }
                    }
                }
                return undefined;
            }
        }
        if (day_database.holiday_in_regions_ids != null) {
            for (let i=0; i<day_database.holiday_in_regions_ids.length; i++) {
                if (day_database.holiday_in_regions_ids[i] == region_id) {
                    // the day is holiday
                    return this.createResponse(day_database, 'holiday');
                }
            }
        }
        if (workdays_in)
        if (day_database.workday_in_regions_ids != null) {
            for (let i=0; i<day_database.workday_in_regions_ids.length; i++) {
                if (day_database.workday_in_regions_ids[i] == region_id) {
                    // the day is workday
                    return this.createResponse(day_database, 'workday');
                }
            }
        }
        if (with_none != undefined) {
            if (with_none) {
                if (day_database.none_in_regions_ids != null) {
                    for (let i=0; i<day_database.none_in_regions_ids.length; i++) {
                        if (day_database.none_in_regions_ids[i] == region_id) {
                            // the day is holiday
                            return this.createResponse(day_database, 'unknown');
                        }
                    }
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
                if (day_database.none_in_countries_ids != null) {
                    for (let i=0; i<day_database.none_in_countries_ids.length; i++) {
                        if (day_database.none_in_countries_ids[i] == country_id) {
                            // the day is holiday
                            return this.createResponse(day_database, 'unknown');
                        }
                    }
                }
                return undefined;
            }
        }

        if (workdays_in)
        if (day_database.holiday_in_countries_ids != null) {
            for (let i=0; i<day_database.holiday_in_countries_ids.length; i++) {
                if (day_database.holiday_in_countries_ids[i] == country_id) {
                    // the day is holiday
                    return this.createResponse(day_database, 'holiday');
                }
            }
        }
        if (day_database.workday_in_countries_ids != null) {
            for (let i=0; i<day_database.workday_in_countries_ids.length; i++) {
                if (day_database.workday_in_countries_ids[i] == country_id) {
                    // the day is workday
                    return this.createResponse(day_database, 'workday');
                }
            }
        }
        
        if (with_none != undefined) {
            if (with_none) {
                if (day_database.none_in_countries_ids != null) {
                    for (let i=0; i<day_database.none_in_countries_ids.length; i++) {
                        if (day_database.none_in_countries_ids[i] == country_id) {
                            // the day is holiday
                            return this.createResponse(day_database, 'unknown');
                        }
                    }
                }
                return undefined;
            }
        }
        return undefined;
    }


    /**
     * Tries to find the day status
     * 
     * Checks by the cached year for country or region
     * 
     * 
     * Based on the signals (cached year or region_id) check by country or by region 
     * and country until identified not found
     * 
     * If region_year_found or region_id not undefined, check by region first.
     * 
     * @param day_database 
     * @param db_country only required to contain id
     * @param country_year_found shows if country has requested year days all in the database
     * @param region_year_found if region was requested, this might be true, if not it is always false
     * @param region_id the requested region_id. In addition to checking by country first, check by region if not found sufficient.
     * @param with_none check by all lists by country_id (or region_id)
     * @param only_none check only none_in_countries if true
     * @returns prepared response or undefined if day not found
     */
    whatDayStatus( day_database: Day, db_country: Country, country_year_found: boolean, region_year_found: boolean,
        region_id?: number, with_none?: boolean, only_none?: boolean, ) {
        
        // shortcut if year is cached
        if (country_year_found) {
            // day is cached
            let res = this.checkCountryLists(day_database, db_country.id, db_country.workdays);
            if (res == undefined) {
                return this.createResponse(day_database, 'unknown');
            } else return res;
        }
        if (region_year_found) {
            // day is cached, region_id is guaranteed to contain
            let res = this.checkRegionInLists(day_database, region_id, db_country.workdays);
            if (res == undefined) {

                // a day can have country_id instead of all region_id's under one list
                res = this.checkCountryLists(day_database, db_country.id, db_country.workdays);
                if (res == undefined) {
                    return this.createResponse(day_database, 'unknown');
                } else return res;

            } else return res
        }


        if (region_id != undefined) {
            let res = this.checkRegionInLists(day_database, region_id, db_country.workdays, with_none, only_none);
            if (res != undefined) {
                return res;
            }
        }

        let res = this.checkCountryLists(day_database, db_country.id, db_country.workdays, with_none, only_none);
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
     * @param tryLoadDay 
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
                // DO CACHE TO DATABASE>
                if (tryLoadDay.countries_update_promise != undefined) {
                    await tryLoadDay.countries_update_promise;
                }
            }),
            map(e=> {
                return e;
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
     * Checks found country (or region) to have days cached for requested year + finds region_id
     * 
     * Based on the data in the database, either present day status in the response or 
     * present the data from third-party API in last case, caching the day.
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
        let db_country_promise: Promise<Country> =
            (req.country_code != undefined) ?
                this.countryEntityService.findByCodeWithRegions(req.country_code)
                :
                this.countryEntityService.findByNameWithRegions(req.country_name);

        let day_database = this.dayEntityService.find_by_date(req.year, req.month, req.day);

        // will return day if database doesn't have that day for specified country and region.
        // if cached year is found in either region or country, will return true in which found
        // if no country was found, will return update observable promise, that must be awaited, together with day found.
        // day must be cached, depending on whether or not day in the database was found.
        // day found can be empty array
        let day_response_try = this.configService.getConfig().then(
            async cfg => {
                // let hotload: boolean = (cfg.settings.hotload);
                if (cfg.settings.hotload) {
                    return this.tryLoadDay(req, (await db_country_promise), true)
                } else {
                    return null;
                }
            });

        
        let isYear: {
            country_year_found: boolean;
            region_year_found: boolean;
            region_id: number;
        } = undefined;

        // check country and region to have year of days cached
        if ((await db_country_promise) != undefined) {
            this.tryThrowCountryDateLimits((await db_country_promise), req);

            // country is found, country year is cached either for region or country
            isYear = this.isYearOfDayCached(req, (await db_country_promise));
            // save region_id
            

            if ((await day_database) != undefined) {
                
                // day found
                if ((await day_database).absolute == true) {
                    // this day was cached by every region and country, no need to check by none_in... array
                    let res = this.whatDayStatus(
                        (await day_database), 
                        (await db_country_promise), 
                        isYear.country_year_found, 
                        isYear.region_year_found, 
                        isYear.region_id, 
                        false
                    );

                    if (res != undefined) {
                        return res;
                    } else return this.createResponse((await day_database), 'unknown');

                } else {
                    // day is not absolute

                    let res = this.whatDayStatus(
                        (await day_database), 
                        (await db_country_promise), 
                        isYear.country_year_found, 
                        isYear.region_year_found, 
                        isYear.region_id,
                        true
                    );

                    if (res != undefined) {
                        return res;
                    }
                }
            }

            // day not found, country found
            if (isYear.country_year_found || isYear.region_year_found) {
                return this.createResponse(req, 'unknown');
            }

            // day could have been found, but no country_id or region_id found --> update
            // day could have been not found, country doesn't have cached days --> create
            

        }


        let tryLoadDay = ((await day_response_try) != null) ? 
            (await day_response_try) 
            : (await this.tryLoadDay(req));

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
        
        // if (!tryLoadDay.country_year && !tryLoadDay.region_year) {

        return ((tryLoadDay.day_obs) as Observable<IDay[]>).pipe(
            tap((day: IDay[]) => {
                day_database.then(day_database => {
                    if (day_database != undefined) {
                        // update day
                        let response_day = (day.length == 0) ? null : day[0];
                        
                            if (tryLoadDay.countries_update_promise != undefined) {
                                // changes in countries detected
                                // new country was added and requires an update
                                // new days might be linked to that country/region
                                this.tryCreateOrUpdateDay_WhenCountriesDidChange(
                                    tryLoadDay.countries_update_promise,
                                    req,
                                    response_day,
                                    day_database
                                );
                            } else {
                                db_country_promise.then(db_country_promise => {
                                    this.dayEntityService.updateOneDayFromResponse(
                                        response_day, 
                                        (day_database),
                                        (db_country_promise),
                                        isYear.region_id
                                    ).finally();
                                });
                            }
                    } else {
                        // create
                        let response_day = (day.length == 0) ? null : day[0];
                        
                        if (tryLoadDay.countries_update_promise != undefined) {
                            // changes in countries detected
                            // new country was added and requires an update
                            // new days might be linked to that country/region
                            this.tryCreateOrUpdateDay_WhenCountriesDidChange(
                                tryLoadDay.countries_update_promise,
                                req,
                                response_day,
                                day_database
                            );
                        } else {
                            db_country_promise.then(db_country_promise => {
                                this.dayEntityService.createOneDayFromResponse(
                                    response_day, 
                                    req,
                                    (db_country_promise).id,
                                    isYear.region_id
                                ).finally();
                            })
                        }
                        
                            
                        
                    }
                });
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
            // return day;
        // } else {
        //     throw new HttpException(
        //         {"code": 500, 
        //         "message": 
        //         "Day was not found, but it must be cached. Try again.", 
        //         "error": "Internal Server Error"}, 
        //         HttpStatus.INTERNAL_SERVER_ERROR);
        // }
    }

    /**
     * Try to update countries and save new days
     * 
     * Run if changes in countries are detected.
     * 
     * new country was added and requires an update
     * 
     * new days might be linked to that country/region
     * @param countries_update_promise 
     * @param req 
     * @param response_day 
     * @param day_database 
     */
    tryCreateOrUpdateDay_WhenCountriesDidChange(
        countries_update_promise: Promise<void> | Promise<{
            savedCountries: Country[];
            savedRegions: Region[];
        }>, 
        req: StatusDtoRequest, 
        response_day: IDay, 
        day_database: Day) {

        countries_update_promise.then(res => {
            try {
                this.cacheDayForJustCreatedCountry(res, req, response_day, (day_database)).finally();
                


            } catch {
                // day might be created for new region/county
                this.cacheDayForQuestionableCountry(req, response_day, (day_database)).finally();
            }
        });
    }


    /**
     * Updates or creates the day in the database
     * 
     * Saving day with new country/region ids, that was just saved.
     * 
     * @param res 
     * @param req 
     * @param day_response 
     * @param day_database 
     * @throw HttpException
     */
    async cacheDayForJustCreatedCountry(res: any, req: StatusDtoRequest, day_response: IDay, day_database: Day) {
        let newSavedCountries: Country[] = res.savedCountries;

        let obtainedCountry: Country = undefined;
        let region_id: number = undefined;
        for (let i=0; i<newSavedCountries.length; i++) {
            if (req.country_code != undefined) {
                if (newSavedCountries[i].code == req.country_code) {
                    // need to get whole regions array. return from creation doesn't provide it
                    obtainedCountry = await this.countryEntityService.findByIdWithRegions(newSavedCountries[i].id);
                }
            } else if (req.country_name != undefined) {
                if (newSavedCountries[i].full_name == req.country_name) {
                    // need to get whole regions array. return from creation doesn't provide it
                    obtainedCountry = await this.countryEntityService.findByIdWithRegions(newSavedCountries[i].id);
                }
            }
        }
        if (req.region_code != undefined) {
            let lower_region_code = req.region_code.toLowerCase();
            for (let i=0; i<obtainedCountry.regions.length; i++) {
                if (obtainedCountry.regions[i].code == lower_region_code) {
                    region_id = obtainedCountry.regions[i].id;
                    break;
                }
            }
        }

        if (obtainedCountry != undefined) {
            if (req.region_code != undefined){
                if (region_id == undefined) {
                    // error
                    throw new HttpException(
                        {"code": 500, 
                        "message": 
                        "Requested region_id wasn't found cached, but day for this region was found from API response", 
                        "error": "Internal Server Error"}, 
                        HttpStatus.INTERNAL_SERVER_ERROR);
                }
            }
            if (day_database != undefined) {
                await this.dayEntityService.updateOneDayFromResponse(
                    day_response,
                    day_database,
                    obtainedCountry,
                    region_id
                );
            } else await this.dayEntityService.createOneDayFromResponse(
                day_response,
                req,
                obtainedCountry.id,
                region_id
            );
            
        } else {
            throw new HttpException(
                {"code": 500, 
                "message": 
                "Requested country wasn't found cached, but day for this country was found from API response", 
                "error": "Internal Server Error"}, 
                HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Creates or updates a new day in the database
     * 
     * Here know for sure that country lists are updated,
     * however new country/region might not have been requested and
     * as a consequence has nothing to do with the day of question.
     * 
     * In any way try to find country by code or name provided in the request
     * from the database
     * 
     * @param req 
     * @param day_response 
     * @param day_database 
     * @throw HttpException
     */
    async cacheDayForQuestionableCountry(req: StatusDtoRequest, day_response: IDay, day_database: Day) {

        let new_country: Country = (req.country_code != undefined) ?
            await this.countryEntityService.findByCodeWithRegions(req.country_code)
            : await this.countryEntityService.findByNameWithRegions(req.country_name)
        
        let region_id: number = undefined;
        if (req.region_code != undefined) {
            if (new_country != undefined) {
                if (new_country.regions.length == 0) {
                    // error
                    throw new HttpException(
                        {"code": 500, 
                        "message": 
                        "Requested country doesn't have regions, but day for one of the regions was found from API response", 
                        "error": "Internal Server Error"}, 
                        HttpStatus.INTERNAL_SERVER_ERROR);
                } else {
                    for (let i=0; i<new_country.regions.length; i++) {
                        if (new_country.regions[i].code == req.region_code) {
                            region_id = new_country.regions[i].id;
                            break;
                        }
                    }
                }
            } else {
                // error
                throw new HttpException(
                    {"code": 500, 
                    "message": 
                    "Requested country wasn't found cached, but day for this country was found from API response", 
                    "error": "Internal Server Error"}, 
                    HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }

        if (day_database != undefined) {
            await this.dayEntityService.updateOneDayFromResponse(
                day_response, 
                day_database, 
                new_country, 
                region_id
            );
        } else await this.dayEntityService.createOneDayFromResponse(
            day_response,
            req,
            new_country.id,
            region_id
        );
        
    }

    /**
     * Tries to load day data from the third-party API
     * 
     * However if the request only has country name, it will try to check given country found 
     * from the database to have requested year days cached. It will not make a request 
     * to the third-party API, if year is found to be cached.
     * 
     * If the country was not found in the database, it will create a promise, that
     * will need to be awaited in order to update the database.
     * 
     * @param req 
     * @param db_country 
     * @param hotload identifies if was launched by hotload (might be used by logging)
     * @returns 
     */
    async tryLoadDay(req: StatusDtoRequest, db_country?: Country, hotload?: boolean) {
        let date = 
            ((req.day > 9) ? 
                req.day
                : ("0"+req.day)) 
            + "-" + 
            ((req.month > 9) ?
                req.month
                : ("0"+req.month))
            + "-" + 
            req.year;

        let countries_update_promise: Promise<{
            savedCountries: Country[];
            savedRegions: Region[];
        }> | Promise<void> = undefined;

        let country_code: string = undefined;

        let country_year_found = false;
        let region_year_found = false;

        let day_obs: Observable<IDay[]> = undefined;
        let e: IStatusOfDayRequestError = new Object();

        let country_name_not_found_case: {
            country_code: string;
            countries_update_promise: Promise<{
                savedCountries: Country[];
                savedRegions: Region[];
            }> | Promise<void>
        } = undefined;


        if (req.country_code == undefined) {
            // will require to pull data from the database to know country code
            if (db_country != undefined) {
                this.tryThrowCountryDateLimits(db_country, req);
                // get the country code
                country_code = db_country.code;

                let res = this.isYearOfDayCached(req, db_country);
                country_year_found = res.country_year_found;
                region_year_found = res.region_year_found;

            } else {
                // country not found
                country_name_not_found_case = await this.tryCountryCodeFromApi(req.country_name);
            }
        } else {
            country_code = req.country_code;
        }
        
        if (req.country_code == undefined && country_code == undefined) {
            // no country with specified name was found, therefore no day return
            // this case will return value country_code as undefined
            e.country_name = es.addError(e.country_name, "not found");
        } else {
            if ((!country_year_found) || (!region_year_found)) {
                try {
                    day_obs = this.callendarService.getDay(date, country_code, req.region_code);
                } catch (e) {
                    return {
                        // identifies if method was called from hotload
                        "hotload": (hotload == undefined)? 
                        false 
                        : (hotload == true) ? 
                            true 
                            : false,
                        // contains error if country wasn't found by name
                        "error": e.response.error,
                        // if country_code provided from request returns country_code requested
                        // if country_code wasn't provided may have country_code from found country by country_name
                        "country_code": (country_name_not_found_case == undefined) ? 
                            country_code 
                            : country_name_not_found_case.country_code,
                        // identifies if days are cached under requested country year
                        "country_year": country_year_found,
                        // identifies if days are cached under requested region year
                        "region_year": region_year_found,
                        // promise to either create or update countries/regions found. provide some output
                        "countries_update_promise": (country_name_not_found_case == undefined) ? 
                            countries_update_promise 
                            : country_name_not_found_case.countries_update_promise,
                        // day found from api
                        "day_obs": undefined
                    }
                }
                
            }
        }

        return {
            // identifies if method was called from hotload
            "hotload": (hotload == undefined)? 
                false 
                : (hotload == true) ? 
                    true 
                    : false,
            // contains error if country wasn't found by name
            "error": (Object.entries(e).length === 0)? 
                undefined 
                : e,
            // if country_code provided from request returns country_code requested
            // if country_code wasn't provided may have country_code from found country by country_name
            "country_code": (country_name_not_found_case == undefined) ? 
                country_code 
                : country_name_not_found_case.country_code,
            // identifies if days are cached under requested country year
            "country_year": country_year_found,
            // identifies if days are cached under requested region year
            "region_year": region_year_found,
            // promise to either create or update countries/regions found. provide some output
            "countries_update_promise": (country_name_not_found_case == undefined) ? 
                countries_update_promise 
                : country_name_not_found_case.countries_update_promise,
            // day found from api
            "day_obs": day_obs
        }
    }

    /**
     * Checks if found country (or its requested region) from the database has full year of days saved
     * 
     * Finds region_id if region code was provided in the request
     * 
     * @param req 
     * @param db_country 
     * @returns 
     */
    isYearOfDayCached(req: StatusDtoRequest, db_country: Country) {
        let country_year_found = false;
        let region_year_found = false;
        let region_id: number = undefined;

        // next identify if day of requested year was saved, when full year list was requested.
        if (db_country.years != null) {
            for (let i = 0; i <db_country.years.length; i++) {
                if (db_country.years[i] == req.year) {
                    // identify that no check for none_in_countries and none_in_regions is required

                    country_year_found = true;
                    break;
                }
            }
            if (!country_year_found) {
                if (db_country.regions.length != 0) {
                    for (let i = 0; i < db_country.regions.length; i++) {
                        if (db_country.regions[i].code == req.region_code) {
                            if (db_country.regions[i].years != null) {
                                for (let j = 0; j < db_country.regions[i].years.length; j++) {
                                    if (db_country.regions[i].years[j] == req.year) {
                                        region_year_found = true;
                                        region_id = db_country.regions[i].id;
                                        break;
                                    }
                                }
                                break;
                            }

                        }
                    }
                }

            }
        }

        return {country_year_found, region_year_found, region_id}
    }

    /**
     * Tries to find country code from third-party API by the country name
     * 
     * Creates save promise of all countries if no countries exist in the database
     * Create promise to update countries with new country/ies
     * 
     * @param req 
     * @returns has to await on countries_update_promise if such exists, ignore if country_code undefined
     */
    async tryCountryCodeFromApi(country_name: string) {
        // get all countries from database
        let countries_database = this.countryEntityService.findAll();
        // get all countries from response
        let countries_response = this.callendarService.getCountries();

        let countries_update_promise: Promise<{
            savedCountries: Country[];
            savedRegions: Region[];
        }> | Promise<void> = undefined;

        let country_code: string = undefined;

        let lower_country_name = country_name.toLowerCase();

        for (let i = 0; i < (await lastValueFrom(countries_response)).length; i++) {
            if ((await lastValueFrom(countries_response))[i].fullName.toLowerCase() == lower_country_name) {
                country_code = (await lastValueFrom(countries_response))[i].countryCode;
                // here we know for sure, that countries in the database needs to be updated.
                if ((await countries_database).length) {
                    countries_update_promise = this.countryEntityService
                        .saveAllNew(
                            (await lastValueFrom(countries_response)));
                } else {
                    countries_update_promise = this.countryEntityService
                        .tryUpdateFromAPI(
                            (await countries_database),
                            (await lastValueFrom(countries_response)));
                }
            }
        }

        return {country_code, countries_update_promise}
    }
}
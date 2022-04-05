import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { lastValueFrom, map, Observable, tap } from 'rxjs';
import { ICountry, IDay } from 'src/integrations/holiday_callendar_api/callendar.interface';
import { CallendarService } from 'src/integrations/holiday_callendar_api/callendar.service';
import { Country } from 'src/models/country/country.entity';
import { ICountryEntityWithRegions } from 'src/models/country/country.interface';
import { CountryEntityService } from 'src/models/country/country.service';
import { Day } from 'src/models/day/day.entity';
import { DayEntityService } from 'src/models/day/day.service';
import { Region } from 'src/models/region/region.entity';
import { HolidaysDtoRequest } from '../holidays/holidays.dto';
import { HolidaysResourceService } from '../holidays/holidays.service';
import { StatusOfDayResourceService } from '../status/status.service';
import { ErrorService as es } from "src/errors/adderror.service";
import { IHolidaysRequestError } from '../holidays/holidays.interface';
import { ConfigService } from 'src/config/config.service';
import { DaysInMonthsService } from 'src/utilities/dim.service';
import { DaysAndDim, IDayWithDayNumber } from './freed.interface';
import { ListingService } from 'src/utilities/listing.service';
import { CacherService } from 'src/cacher/cacher.service';
import { CallendarPrepareService } from 'src/integrations/holiday_callendar_api/data_prepare/prepdays.service';
import { DateLimitsThrowingService } from 'src/utilities/throwers/date_limits/date_limits.service';


@Injectable()
export class FreeDaysResourceService {
    constructor(
        private readonly countryEntityService: CountryEntityService,
        private readonly dayEntityService: DayEntityService,
        private readonly holidaysResourseService: HolidaysResourceService,
        private readonly statusOfDayResourceService: StatusOfDayResourceService,
        private readonly callendarService: CallendarService,
        private readonly configService: ConfigService,
        private readonly dimService: DaysInMonthsService,
        private readonly ls: ListingService,
        private readonly cacherService: CacherService,
        private readonly callPrepService: CallendarPrepareService,
        private readonly dateLimitsThrowService: DateLimitsThrowingService
    ) {}


    async prepareMaxFoundDaysInRow(req: HolidaysDtoRequest) : 
    Promise<
        { max_free_days_in_row: number;} | 
        Observable<{ max_free_days_in_row: number;}>
    > {

        /**
         * Identifies if all days for requested are saved, under region or country. 
         */
        let isYear: {
            country_year_found: boolean;
            region_year_found: boolean;
        } = undefined;

        /**
         * Finds days that have week_days number (only sorted by month)
         */
        let db_days_promise: Promise<Day[]> = 
            this.dayEntityService.findByYearWithWeekDay(req.year);
        
        /**
         * Finds country from the database, if region requested its id will be already included
         */
        let db_country_ryi: ICountryEntityWithRegions = 
            await this.countryEntityService.findByWithRegions(
                req.country_name, req.country_code, req.region_code);

        
        /**
         * Loading days from the third-party API if hotload is on
         */
        let response_days_try = this.callPrepService.tryHotLoadDays({
            req,
            db_country_ryi,
            hotload: true
        });

        isYear = this.callPrepService.isYearOfDayCached(
            req.year,
            db_country_ryi.country_years,
            db_country_ryi.region_years
        );

        // await days from database and nullify promise
        let db_days = (await db_days_promise);
        db_days_promise = null;

        if (db_country_ryi != null) {
            // country found in the database

            // try country date limits
            this.dateLimitsThrowService.tryThrowYearLimits(
                db_country_ryi.starting_date,
                db_country_ryi.ending_date, 
                req.year
            );

            

            
            
            
            if (db_days.length != 0) {
                // country was found
                // days were found (they need to be sorted by day)

                // find if region or country has year of days saved
                
                
                
                if (isYear.country_year_found) {
                    // all days must be with country_id
                    // squize info and return it
                    return this.createResponse(
                        this.addDayNumberFromDatabase(
                            db_days, 
                            this.dimService.getDaysAmmountsForYear(db_days[0].year), 
                            db_country_ryi.country_id, 
                            db_country_ryi.workdays,
                            undefined // no region_ids anywhere in days, even if region_id is provided
                        )
                    );
                }
                
                
                if (isYear.region_year_found) {
                    // all days must be with country_id or region_id
                    // squize info and return it
                    return this.createResponse(
                        this.addDayNumberFromDatabase(
                            db_days, 
                            this.dimService.getDaysAmmountsForYear(db_days[0].year), 
                            db_country_ryi.country_id, 
                            db_country_ryi.workdays, 
                            db_country_ryi.region_id
                        )
                    );
                }
                
            }

        }
 
        // days in the database were not found to be enough or none found
        // address hotloaded values or call them if they were not called
        let tryLoadDay = ((await response_days_try) != null) ? 
            (await response_days_try) 
            : await (this.callPrepService.tryLoadDays({
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

        // several option from here, either some days or no days were found at all.
        // additionally there might be a chance of new country/region, so it needs to be awaited
        // will need to create or update existing if response contain data.

        // cached years of country or region used as a verification, that all
        // days are saved for this year. It's possible that all days are saved,
        // but without verification (use of sql transactions vs data race problem)
        // its not possible to say if all days are saved in time




        // find free days 
        // return and cache
        return ((tryLoadDay.days_obs) as Observable<IDay[]>).pipe(
            tap((response_days: IDay[]) => {
                // check if changes are required for countries to await
                
                // update or create days with identifications 
                // for which they were found to be workday or holiday

                // update, set or mitigate 
                // (saved days under year identificator)
                // the cached_year for
                // country or region
                db_days_promise.then(async database_days => {

                    // let create_of_data: boolean = undefined;
                    // let update_in_data: boolean = undefined;


                    await this.cacherService.cacheAroundDays({
                        country_name: req.country_name,
                        country_code: req.country_code,
                        region_code: req.region_code,
                        db_country_ryi: db_country_ryi,
                        year: req.year,
                        db_days: database_days,
                        rp_days: response_days,
                        countries_update_promise: tryLoadDay.countries_update_promise
                    });

                    // if(tryLoadDay.countries_update_promise != undefined) {
                    //     // perform countries change (create new or update by chance)
                    //     let res = await tryLoadDay.countries_update_promise;
                    //     if (this.isCreateResponse(res)) {
                    //         create_of_data = true;
                    //     } else {
                    //         update_in_data = true;
                    //     }
                    //     // data returned cannot be used
                    //     // division with create_of_data and update_in_data currently is useless
                    //     // keep current format for future changes if such will take place
                    //     // there're should be less requests to the database
                    //     // there're should be a way to receive useful data on changing response
                    // }
                    // await this.cacherService.cacheAroundDays_withYears(
                    //     req.country_name,
                    //     req.country_code,
                    //     req.region_code,
                    //     db_country_ryi,
                    //     req.year,
                    //     database_days,
                    //     response_days,
                    //     create_of_data,
                    //     update_in_data
                    // );
                });
            }),
            map((days: IDay[]) => {
                // squize info and return it
                return this.createResponse(
                    this.addDayNumberFromResponse(
                        days, 
                        this.dimService.getDaysAmmountsForYear(days[0].date.year)
                    )
                );

            })
        );


        



        // these are some old draft notes, will keep them for now
        
        // Database:
        // - get days with weekday number and sort days for each month
        // - try to get country from database by code or name
        // - tryThrowYearLimits
        // - check cached years (isYear)
        // - check if workdays exist for this country
        // - if year cached use database, if not get data from hotload or make new if it wasn't made

        // API (hotload):
        // - if country_name, but no country_code, then tryCountryCodeFromApi
        // - after code found, make a request to API to get list of days that are holidays or workdays.

        // Caching:
        // - if country not found
        // - if year not cached
        // - 

        // try to get one country that is requested. check cached year (isYear)
        // hotload all countries if country_code wasn't given (tryCountryCodeFromApi)

        // try to get days of specified year, that only has weekday number
        // hotload request to the api on year days (weekday, holiday (if country_name, then try ask database or get all countries))
    }

    /**
     * Checks if return was from update or creation of countries/regions
     * 
     * Since there's no jointable link between saved countries and regions
     * data provided cannot be further used, which means call to the database will be required
     * 
     * This function determines, what happened
     * @param res 
     * @returns 
     */
    isCreateResponse(res: any) {
        try {
            let o = (res as {
                savedCountries: Country[];
                savedRegions: Region[];
            }).savedCountries;
            return true;
        } catch {
            return false;
        }
    }


    /**
     * Returns number of maximally available free days in a row
     * 
     * Addresses findFreeDaysInRow and returns prepared output
     * @param ddim 
     * @returns 
     * @throws HttpException
     */
    createResponse(ddim: DaysAndDim) {
        let max_free_days = this.findFreeDaysInRow(ddim);
        return {
            "max_free_days_in_row": max_free_days
        }
    }

    /**
     * Finds the number of free days in a row using given days data and dim
     * @param ddim days and (days in month array)
     * @returns 
     * @throws HttpException
     */
    findFreeDaysInRow(ddim: DaysAndDim) {
        //todo  add check for the last day

        if (ddim.days.length == 0) {
            throw new HttpException({ "code": 404, "error": "Days were not found"}, HttpStatus.BAD_REQUEST)
        }

        
        
        // maximum number of found free days in a row
        let max_free_days: number = undefined;
        

        // main for loop
        for (let i=0; i<ddim.days.length; i++) {
            if (ddim.days[i].day.holidayType == "extra_working_day") {
                continue;
            }

            // first day in found row
            // if first_day was not found it is indication, that no holidays were found
            let first_day: IDayWithDayNumber = ddim.days[i];

            // current day will be used to compare with next day, for case when there're more than 2 days in free days row
            let current_day = ddim.days[i];
            
            // last day in found row
            let last_day: IDayWithDayNumber = undefined;

            // identifies if required to end main for loop
            let stop = false;

            // inner for loop
            // get the next day until it no longer adds to the row of freedays
            for (let j=i+1; j<ddim.days.length; j++) {
                // ddim.days[j] is the next day
                
                if (stop) {
                    break;
                }

                // find the difference in days between current and next
                let days_diff = ddim.days[j].day_number - current_day.day_number;

                if (days_diff < 4) {
                    switch (days_diff) {
                        case(1): {
                            // next day can be any day

                            // when it is Saturday or Sunday, 
                            // only check if next day is workday
                            // in other cases make a stop, break and finalize

                            if (ddim.days[j].day.holidayType == "extra_working_day") {
                                // it is workday -> stop to finalize the free days row
                                last_day = current_day;
                                i = j+1;
                                stop = true;
                                break;
                            } else {
                                // add the day to free days row and continue
                                current_day = ddim.days[j];
                                i = j+1;
                                break;
                            }
                        }
                        case (2): {
                            // interested in next day only if it is Saturday or Friday
                            // in other cases make a stop, break and finalize

                            if (current_day.day.date.dayOfWeek == 5) {
                                // it is Friday
                                if (ddim.days[j].day.holidayType == "extra_working_day") {
                                    // Sunday is a workday
                                    // end free days in a row on Saturday
                                    last_day = this.generateNextDay(current_day, 1, ddim.dim);
                                    stop = true;
                                    i = j+1;
                                    break;
                                } else {
                                    // Sunday is a holiday
                                    // extend free days in a row until Sunday
                                    current_day = this.generateNextDay(current_day, 1, ddim.dim);
                                    i = j+1;
                                    break;
                                }
                            }

                            // days is not interesting, make last, stop, break and finalize
                            if (current_day.day.date.dayOfWeek != 6) {
                                last_day = current_day;
                                stop = true;
                                i = j+1;
                                break;
                            }
                            // but if the current day is Saturday continue to next case
                        }
                        case (3): {
                            // interesting if current day is Friday
                            // on other cases make a stop, break and finalize

                            if (current_day.day.date.dayOfWeek == 5 ||
                                (current_day.day.date.dayOfWeek == 6 && days_diff == 2)) {
                                    // check if Monday is a holiday
                                    if (ddim.days[j].day.holidayType == "public_holiday") {
                                        current_day = ddim.days[j];
                                        i = j+1;
                                        break;
                                    } else {
                                        // Monday is a workday (extra_working_day(?))
                                        // end free days in a row on Sunday

                                        // create Sunday
                                        last_day = this.generateNextDay(current_day, 1, ddim.dim)
                                        stop = true;
                                        i = j+1;
                                        break;
                                    }
                                }
                        }
                    }
                } else {
                    // Out of scope, break to finalize

                    // if inner for loop continued at least once
                    // and now is here
                    // need to move next iterable day in main for loop
                    // so the next day in main for loop would be the day,
                    // which appeared here not interesting

                    // example
                    // i=1, j=2, difference not interesting -> for loop adds 1 to i, next i=2
                    // i=1, j=3, some difference was found to be interesting, but ended here ->
                        // for loop adds 1 to i
                            // and we still need to check day which found to be not interesting here
                        // so to achieve that: i=j-1, so next i=3
                    if (j-1 != i) {
                        i = j-1;
                    }
                    break;
                }
            }
            let free_days_in_row = 0;
            // obtain the difference of days
            if (last_day == undefined) {
                // there were no close encounters for this day
                
                // Check week day and check if there any left days in a year
                if (first_day.day.date.dayOfWeek == 5) {
                    // check if we can add 6,7
                    if (first_day.day.date.year%4) {
                        // it is not leap year
                        let left_days = 365-first_day.day_number
                        if (left_days>2) {
                            free_days_in_row = 3;
                        // }
                        //  else if (left_days == 1) {
                        //     free_days_in_row = 2;
                        } else continue;
                    } else {
                        // it is leap year
                        let left_days = 366-first_day.day_number
                        if (left_days>2) {
                            free_days_in_row = 3;
                        // } else if (left_days == 1) {
                        //     free_days_in_row = 2;
                        } else continue;
                    }
                } else continue;
                
                // if (first_day.day.date.dayOfWeek == 6) {
                //     // check if we can add 7
                //     if (first_day.day.date.year%4) {
                //         // it is not leap year
                //         let left_days = 365-first_day.day_number
                //         if (left_days>1) {
                //             free_days_in_row = 2;
                //         } else continue;
                //     } else {
                //         // it is leap year
                //         let left_days = 366-first_day.day_number
                //         if (left_days>1) {
                //             free_days_in_row = 2;
                //         } else continue;
                //     }
                // } else continue;
                

            // } else if (last_day == first_day) {
            //     // the first_day is last day of year
            //     // no need to check if day is the last day of the year
            //     free_days_in_row = 1;
            } else {
                free_days_in_row = last_day.day_number - first_day.day_number;
            }
            
            if (free_days_in_row > 2) {
                if (max_free_days == undefined 
                    || max_free_days < free_days_in_row) {
                        max_free_days = free_days_in_row;
                }
            }
            

        }

        if (max_free_days == undefined) {
            if (ddim.days.length > 51) {
                // there's an extreme condition of more than 51 workdays in days
                return this.freeDaysMaximumOnlyWorkdays(ddim);
            } else return 2;
        } else return max_free_days;
    }

    /**
     * Generates a day that succeeded given day (d)
     * 
     * However if succeeded day is out of year bounds, returns given day (d)
     * @param d 
     * @param change 
     * @param dim 
     * @returns new generated day of given d
     */
    generateNextDay(d: IDayWithDayNumber, change: number, dim: number[]) {
        // find next day - day number
        let dn = d.day_number + change;
        let next_day_day_number: number = undefined;
        
        // if day is a leap year, then true
        let leap_year = !(d.day.date.year % 4);
        if (leap_year) {
            if (dn > 365) {
                // try silently return given day, 
                // because year limits reached
                return d
            }
        } else {
            if (dn > 366) {
                // try silently return given day, 
                // because year limits reached
                return d
            }
        }
        next_day_day_number = dn;

        // find out the weekday of next day
        let m = (d.day.date.dayOfWeek + change) % 7;
        let next_day_week_day = m==0?7:m;

        let next_day_month = undefined;
        // over_days identifies day that doesn't follow month restriction
        // it is made from adding prev date day to the change made.
        // example: if the day is 31 and change is 1, then over_days will be 32
        let over_day = d.day.date.day + change;
        if (dim[d.day.date.month-1] < over_day) {
            for (let p = -1; p<11; p++) {
                // make over_day to follow next month restrictions
                over_day = over_day - dim[d.day.date.month+p];
                let days_in_this_month = dim[d.day.date.month + 2 + p]
                if (days_in_this_month < over_day) {
                    continue;
                } 
                next_day_month = d.day.date.month + 3 + p;
            }
        }

        let new_day: IDayWithDayNumber = {
            "day": {
                "date": {
                    "day": over_day,
                    "month": (next_day_month == undefined)?
                        d.day.date.month
                    :next_day_month,
                    "year": d.day.date.year,
                    "dayOfWeek": next_day_week_day
                },
                "holidayType": "public_holiday"
            },
            "day_number": next_day_day_number
            }
        
        return new_day;
    }


    /**
     * Creates days list with day year number from 1-365/366
     * @param days 
     * @param months_days 
     * @returns
     */
    addDayNumberFromResponse(days: IDay[], months_days: number[]): DaysAndDim {
        let new_days: IDayWithDayNumber [] = [];
        for (let i=0; i<days.length; i++) {
            new_days.push(this.addDayNumber(days[i], months_days))
        };
        return {"days": new_days, "dim": months_days};
    }

    /**
     * Finds the day's number in the year
     * @param day 
     * @param months_days 
     * @returns given IDay as IDay (no change) and day_number
     */
    addDayNumber(day: IDay, months_days: number[]): IDayWithDayNumber {
        // number in year (day number)
        let niy = 0
            for (let j=0; j<months_days.length; j++) {
                if (day.date.month != (j+1)) {
                    niy +=months_days[j];
                } else break;
            }
            
            return ({
                "day": day,
                "day_number": niy+day.date.day
            })
    }

    /**
     * Sorts by the day_number
     * @param days 
     * @returns 
     */
    sortByDayNumber(days: IDayWithDayNumber[]) {
        return days.sort((a,b) => {
            return (+a.day_number) - (+b.day_number)
        });
    }

    /**
     * Returns prepared list, that has country or region id in holiday
     * or workday
     * 
     * Sorts the lists by the day number
     * @param days 
     * @param months_days 
     * @param country_id 
     * @param workdays 
     * @param region_id 
     * @returns 
     */
    addDayNumberFromDatabase(days: Day[], months_days: number[], country_id: number, workdays: boolean, region_id?: number) : DaysAndDim {
        let new_days: IDayWithDayNumber [] = [];

        if (region_id != undefined) {
            if (workdays) {
                for (let i=0; i<days.length; i++) {
                    let day = this.parseDayToIDay_WithWorkdays_WithRegion(days[i], country_id, region_id)
                    if (day != undefined) {
                        new_days.push(
                            this.addDayNumber(day, months_days)
                        );
                    }
                }
            } else {
                for (let i=0; i<days.length; i++) {
                    let day = this.parseDayToIDay_NoWorkdays_WithRegion(days[i], country_id, region_id)
                    if (day != undefined) {
                        new_days.push(
                            this.addDayNumber(day, months_days)
                        );
                    }
                }
            }
        }
        if (workdays) {
            for (let i=0; i<days.length; i++) {
                let day = this.parseDayToIDay_WithWorkdays_OnlyCountry(days[i], country_id)
                if (day != undefined) {
                    new_days.push(
                        this.addDayNumber(day, months_days)
                    );
                }
            }
        } else {
            for (let i=0; i<days.length; i++) {
                let day = this.parseDayToIDay_NoWorkdays_OnlyCountry(days[i], country_id)
                if (day != undefined) {
                    new_days.push(
                        this.addDayNumber(day, months_days)
                    );
                }
            }
        }

        if (new_days.length > 1) {
            new_days = this.sortByDayNumber(new_days);
        }
        return {"days": new_days, "dim": months_days};
        
    }

    /**
     * Parses day to IDay 
     * if the country_id is found in holiday_in.. or workday_in..
     * 
     * @param day 
     * @param country_id 
     * @returns parsed day or undefined if not found
     */
    parseDayToIDay_WithWorkdays_OnlyCountry(day: Day, country_id: number): IDay | undefined {
        let res_try = this.parseDayToIDay_NoWorkdays_OnlyCountry(day, country_id)
        if (res_try != undefined) {
            return res_try;
        }

        if (this.ls.doesListContainValue(day.workday_in_countries_ids, country_id)) {
            return this.parseDayToIDay(day, true);
        }
        return undefined;
    }

    /**
     * Parses day to IDay
     * if the country_id or region_id found in holiday_in.. or workday_in..
     * 
     * @param day 
     * @param country_id 
     * @param region_id 
     * @returns parsed day or undefined
     */
    parseDayToIDay_WithWorkdays_WithRegion(day: Day, country_id: number, region_id: number): IDay | undefined {
        let res_try = this.parseDayToIDay_NoWorkdays_WithRegion(day, country_id, region_id);
        if (res_try != undefined) {
            return res_try;
        }

        res_try = this.parseDayToIDay_WithWorkdays_OnlyCountry(day, country_id);
        if (res_try != undefined) {
            return res_try;
        }
        
        if (this.ls.doesListContainValue(day.workday_in_regions_ids, region_id)) {
            return this.parseDayToIDay(day, true);
        }
        
        return undefined;
    }

    /**
     * Parses day to IDay
     * if the country_id was found in holiday_in
     * @param day 
     * @param country_id 
     * @returns parsed day or undefined
     */
    parseDayToIDay_NoWorkdays_OnlyCountry(day: Day, country_id: number): IDay | undefined {
        if (this.ls.doesListContainValue(day.holiday_in_countries_ids, country_id)) {
            return this.parseDayToIDay(day)
        }
        return undefined;
    }

    /**
     * Parses day to IDay
     * if the country_id or region_id was found in holiday_in
     * @param day 
     * @param country_id 
     * @param region_id 
     * @returns parsed day or undefined
     */
    parseDayToIDay_NoWorkdays_WithRegion(day: Day, country_id: number, region_id: number): IDay | undefined {
        let only_country_try = this.parseDayToIDay_NoWorkdays_OnlyCountry(day, country_id);
        if (only_country_try != undefined) return only_country_try

        if (this.ls.doesListContainValue(day.holiday_in_regions_ids, region_id)) {
            return this.parseDayToIDay(day);
        }
        return undefined;
        
    }

    /**
     * Makes Day entity to the IDay format
     * to be the same as the output from the t-p API response
     */
    parseDayToIDay(day: Day, workday?: boolean) {
        return {
            "date": {
                year: day.year,
                month: day.month,
                day: day.day,
                dayOfWeek: day.week_day,
            },
            "holidayType": 
                (workday != undefined)?
                    (workday == true)?"extra_working_day":"public_holiday"
                : "public_holiday"
        };
    }

    /**
     * Finds how may free days there're available
     * 
     * Works for extreme conditions when there's a chance, that
     * all there're too many working days and is not known for sure
     * if there're 2 freedays, when it can be less or none
     * @param days 
     * @returns 
     */
    freeDaysMaximumOnlyWorkdays(ddim: DaysAndDim) {

        let months_days = this.dimService.getDaysAmmountsForYear(ddim.days[0].day.date.year);
        if (ddim.days[0].day.date.dayOfWeek == 6) {
            if (ddim.days[0].day.date.month == 1) {
                return 2;
            }
        } else {
            // weekday is 7
            if (ddim.days[0].day.date.month == 1) {
                if (ddim.days[0].day.date.day > 7) {
                    return 2;
                }
            }
        }

        let one_free_day = false;
        let diff_tracker = undefined;
        let saturday_missing = false;
        let sunday_missing = false;

        
        let days_length = ddim.days.length;


        

        for (let i=0; i<days_length; i++) {

            if (diff_tracker != undefined) {
                if (diff_tracker+2 == i) {
                    saturday_missing = false;
                    sunday_missing = false;
                    diff_tracker = undefined;
                }
            }
            // check if next day has a 1 or 7 day difference
            // weekdays 6 must have 1 day difference excluding last week
            // weekdays 7 must have 7 days difference excluding last week
            if (ddim.days[i].day.date.month == 12) {
                if (ddim.days[i].day.date.day == months_days[11]) {
                    // it is the last day of year
                    // no further checking with next day is required
                    break;
                }
            }
            // check if day is the last day in the list
            if ((days_length-1) == i) {
                // its the last day in the list
                // verify if the year doesn't have other day
                if (months_days[1] == 29) {
                    //its a leap year
                    if (ddim.days[i].day.date.dayOfWeek == 6) {
                        if (ddim.days[i].day_number == 365) {
                            // there's another day and it is Sunday
                            one_free_day = true;
                            break;
                        } else if ( 
                            ddim.days[i].day_number < 360 ) {
                                // in this case day Saturday and Sunday wasn't found
                                return 2
                            }
                    }
                    if (ddim.days[i].day_number == 360) {
                        // there's another day and it is Saturday
                        one_free_day = true;
                        break;
                    } else if ( 
                        ddim.days[i].day_number < 359 ) {
                            // in this case day Saturday and Sunday wasn't found
                            return 2
                        }
                    
                    
                } else {
                    // its not a leap year
                    if (ddim.days[i].day.date.dayOfWeek == 6) {
                        if (ddim.days[i].day_number == 364) {
                            // there's another day and it is Sunday
                            one_free_day = true;
                            break;
                        } else if ( 
                            ddim.days[i].day_number < 359 ) {
                                // in this case day Saturday and Sunday wasn't found
                                return 2
                            }
                    }
                    if (ddim.days[i].day_number == 359) {
                        // there's another day and it is Saturday
                        one_free_day = true;
                        break;
                    } else if ( 
                        ddim.days[i].day_number < 358 ) {
                            // in this case day Saturday and Sunday wasn't found
                            return 2
                        }
                }

                

            }
             
            // check next day
            if (ddim.days[i].day.date.dayOfWeek == 6) {
                // day is Saturday
                if (ddim.days[i].day_number+1 != ddim.days[i+1].day_number) {
                    // next sunday not found on the next day
                    
                    if (saturday_missing) {
                        // Saturday and Sunday are not found
                        return 2;
                    }
                    sunday_missing = true;
                    if (diff_tracker == undefined) {
                        diff_tracker = i;
                    }
                    
                    one_free_day = true;
                }
            } else {
                // day is Sunday
                if (ddim.days[i].day_number+6 != ddim.days[i+1].day_number) {
                    // next saturday not found after 6 days
                    
                    if (sunday_missing) {
                        // Sunday and Saturday are not found
                        return 2
                    }
                    saturday_missing = true;
                    if (diff_tracker == undefined) {
                        diff_tracker = i;
                    }
                    
                    one_free_day = true;
                }
            }
            
        }
        if (one_free_day) {
            return 1;
        } else return 0;
    }

    // /**
    //  * #### Tries to load days from the third-party API
    //  * 
    //  * However if the request only has country name, it will try to check given country found 
    //  * from the database to have requested year days cached. It will not make a request 
    //  * to the third-party API, if year is found to be cached.
    //  * 
    //  * If the country was not found in the database, it will create a promise, that
    //  * will need to be awaited in order to update the database.
    //  * 
    //  * ---
    //  * 
    //  * #### Could have been just imported from elsewhere
    //  * Originally this was taken from /resources/status/status.service tryLoadDay() and modified.
    //  * 
    //  * Due to use of ICountryEntityWithRegions and its region_id indicator it is currently not 
    //  * possible to use functions from /status endpoint services.
    //  * 
    //  * ---
    //  * @param req 
    //  * @param db_country_ryi 
    //  * @param hotload 
    //  * @returns 
    //  */
    // async tryLoadDays(
    //     req: HolidaysDtoRequest, db_country_ryi?: ICountryEntityWithRegions, hotload?: boolean) {
        
        
    //     let starting_date = "1-1-"+req.year;
    //     let ending_date = "31-12-"+req.year;

    //     let countries_update_promise: Promise<{
    //         savedCountries: Country[];
    //         savedRegions: Region[];
    //     }> | Promise<void> = undefined;

    //     let country_code: string = undefined;

    //     let country_year_found = false;
    //     let region_year_found = false;

    //     let days_obs: Observable<IDay[]> = undefined;
    //     let e: IHolidaysRequestError = new Object();

    //     let country_name_not_found_case: {
    //         country_code: string;
    //         countries_update_promise: Promise<{
    //             savedCountries: Country[];
    //             savedRegions: Region[];
    //         }> | Promise<void>
    //     } = undefined;


    //     if (req.country_code == undefined) {
    //         // will require to pull data from the database to know country code
    //         if (db_country_ryi != undefined) {

    //             this.holidaysResourseService.tryThrowYearLimits(db_country_ryi, req.year);
    //             // get the country code
    //             country_code = db_country_ryi.country_code;

    //             let res = this.isYearOfDayCached(req.year, db_country_ryi);
    //             country_year_found = res.country_year_found;
    //             region_year_found = res.region_year_found;

    //         } else {
    //             // country not found
    //             country_name_not_found_case = 
    //             await this.statusOfDayResourceService.tryCountryCodeFromApi(req.country_name);
    //         }
    //     } else {
    //         country_code = req.country_code;
    //     }
        
    //     if (req.country_code == undefined && country_code == undefined) {
    //         // no country with specified name was found, therefore no day return
    //         // this case will return value country_code as undefined
    //         e.country_name = es.addError(e.country_name, "not found");
    //     } else {
    //         if (country_year_found == false && region_year_found == false) {
    //             try {
    //                 days_obs = this.callendarService.getDay(starting_date,
    //                     country_code, req.region_code, ending_date);
    //             } catch (e) {
    //                 return {
    //                     // identifies if method was called from hotload
    //                     "hotload": (hotload == undefined)? 
    //                     false 
    //                     : (hotload == true) ? 
    //                         true 
    //                         : false,
    //                     "country_year_found": country_year_found,
    //                     "region_year_found": region_year_found,
    //                     // contains error if country wasn't found by name
    //                     "error": e.response.error,
    //                     "countries_update_promise": (country_name_not_found_case == undefined) ? 
    //                         countries_update_promise 
    //                         : country_name_not_found_case.countries_update_promise,
    //                     // day found from api
    //                     "days_obs": undefined
    //                 }
    //             }
                
    //         }
    //     }

    //     return {
    //         // identifies if method was called from hotload
    //         "hotload": (hotload == undefined)? 
    //             false 
    //             : (hotload == true) ? 
    //                 true 
    //                 : false,
    //         "country_year_found": country_year_found,
    //         "region_year_found": region_year_found,
    //         // contains error if country wasn't found by name
    //         "error": (Object.entries(e).length === 0)? 
    //             undefined 
    //             : e,
    //         // promise to either create or update countries/regions found. provide some output
    //         "countries_update_promise": (country_name_not_found_case == undefined) ? 
    //             countries_update_promise 
    //             : country_name_not_found_case.countries_update_promise,
    //         // days found from api
    //         "days_obs": days_obs
    //     }
    // }

    // /**
    //  * #### Checks if days are saved
    //  * Checks if found country (or its requested region) from the database, 
    //  * has full year of days saved
    //  * 
    //  * Finds region_id if region code was provided in the request
    //  * 
    //  * ---
    //  * #### Could have been modified and just imported from elsewhere
    //  * Originally this was taken from /resources/status/status.service > isYearOfDayCached()
    //  * and modified.
    //  * 
    //  * Due to use of ICountryEntityWithRegions and its region_id indicator it is currently not 
    //  * possible to use functions from /status endpoint services. 
    //  * 
    //  * ---
    //  * 
    //  * @param req 
    //  * @param db_country 
    //  * @returns 
    //  */
    // isYearOfDayCached(year: number, db_country: ICountryEntityWithRegions) {
    //     let res = {
    //         "country_year_found": false,
    //         "region_year_found": false
    //     }

    //     // check country years
    //     if (this.ls.doesListContainValue(db_country.country_years, year)) {
    //         res.country_year_found = true;
    //         return res;
    //     }

    //     // check region years
    //     if (this.ls.doesListContainValue(db_country.region_years, year)) {
    //         res.region_year_found = true;
    //         return res;
    //     }
        
    //     // nothing found
    //     return res;
    // }
}

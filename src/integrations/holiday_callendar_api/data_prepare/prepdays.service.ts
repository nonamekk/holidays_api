import { Injectable } from "@nestjs/common";
import { lastValueFrom, map, Observable } from "rxjs";
import { ConfigService } from "src/config/config.service";
import { Country } from "src/models/country/country.entity";
import { Region } from "src/models/region/region.entity";
import { IDay } from "../callendar.interface";
import { ITryLoadDays, ITryLoadDaysError, ITryLoadDaysReturning, ITryLoadHolidayDaysReturning } from "./prepdays.interface";
import { ErrorService as es } from "src/errors/adderror.service";
import { DateLimitsThrowingService } from "src/utilities/throwers/date_limits/date_limits.service";
import { CountryEntityService } from "src/models/country/country.service";
import { CallendarService } from "../callendar.service";
import { DayEntityService } from "src/models/day/day.service";
import { IMonthsObject } from "src/utilities/descriptor.interface";

@Injectable()
export class CallendarPrepareService {
    constructor(
        private readonly configService: ConfigService,
        private readonly dateLimitsThrowService: DateLimitsThrowingService,
        private readonly countryEntityService: CountryEntityService,
        private readonly callendarService: CallendarService,
        private readonly dayEntityService: DayEntityService
    ) {}

    /**
     * Tries to hotload days if config enables hotload
     * @param input 
     * @returns
     */
    async tryHotLoadDays(input: ITryLoadDays) {
        return this.configService.getConfig().then(
            async cfg => {
                if (cfg.settings.hotload) {

                    input.hotload = true;
                    return this.tryLoadDays(input);
                } else {
                    return undefined;
                }
            }
        );
    }

    async tryHotLoadHolidayDays(input: ITryLoadDays) {
        return this.configService.getConfig().then(
            cfg => {
                if (cfg.settings.hotload) {

                    input.hotload = true;
                    return this.tryLoadHolidayDays(input);
                } else {
                    return undefined;
                }
            }
        )
    }


    async tryLoadHolidayDays(input: ITryLoadDays): Promise<ITryLoadHolidayDaysReturning> {

        /**
         * d - decided data
         * 
         * Contains all required data needed
         */
        let d = await this.tryToDecideOnResponseOfData(input);

        /**
         * Prepared observable that contains
         * - identifier if any days are present
         * - prepared for response list of months with holiday days 
         * - days originally returned
         */
        let prep_obs: Observable<Promise<{
            containing_days: boolean;
            result: IMonthsObject[];
            days: IDay[];
        }>> = undefined;

        if (d.country_code == undefined) {
            // country with specified name wasn't found
            // no day can be found
            d.e.country_name = es.addError(d.e.country_name, "not found");
        } else {
            if (d.country_year_found == false && d.region_year_found == false) {
                try {
                    prep_obs = this.prepareHolidaysFromCallendar(
                        d.country_code, 
                        input.req.year, 
                        d.region_code
                    );
                } catch (e) {
                    return {
                        // identifies if method was called from hotload
                        hotload: (input.hotload == undefined)? 
                        false 
                        : (input.hotload == true) ? 
                            true 
                            : false,
                        country_year_found: d.country_year_found,
                        region_year_found: d.region_year_found,
                        // contains error if country wasn't found by name
                        error: e.response.error,
                        countries_update_promise: (d.country_name_not_found_case == undefined) ? 
                            d.countries_update_promise 
                            : d.country_name_not_found_case.countries_update_promise,
                        prep_obs: undefined
                    }
                }
            }
        }

        return {
            // identifies if method was called from hotload
            hotload: (input.hotload == undefined)? 
                false 
                : (input.hotload == true) ? 
                    true 
                    : false,
            country_year_found: d.country_year_found,
            region_year_found: d.region_year_found,
            // contains error if country wasn't found by name
            error: (Object.entries(d.e).length === 0)? 
                undefined 
                : d.e,
            // promise to either create or update countries/regions found. provide some output
            countries_update_promise: (d.country_name_not_found_case == undefined) ? 
                d.countries_update_promise 
                : d.country_name_not_found_case.countries_update_promise,
            // prepared observable, that contains days originally obtained from response
            // and prepared months list with days in each month
            prep_obs: prep_obs
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
            );
    }


  
    /**
     * #### Tries to load days from the third-party API
     * 
     * Case: country_name is provided instead of country_code
     * - if country provided (db_country_ryi)
     * - check days years, if year found do not make request to the t-p API
     * - return which days were found saved (by region year or country)
     * 
     * Case: db_country_ryi not provided, country_name is requested
     * - make a call to the t-p API to get list of countries
     * - prepare to return update or creation promises for country (and regions)
     * - collects country_code
     * 
     * With obtained country_code either from db_country_ryi, api call or request:
     * - make a request to the t-p API
     * - return day with other data
     * 
     * Contains error in the return if:
     * - not found by country_name anywhere
     * - contains error from t-p API failed response
     * 
     * ---
     * Old comment or short version of previous ->
     *  
     * If the request only has country name, it will try to check given country found 
     * from the database to have requested year days cached. It will not make a request 
     * to the third-party API, if year is found to be cached.
     * 
     * If the country was not found in the database, it will create a promise, that
     * will need to be awaited in order to update the database.
     * 
     * ---
     * @param input 
     * @returns
     */
    async tryLoadDays(input: ITryLoadDays): Promise<ITryLoadDaysReturning> {
        
        /**
         * d - decided data
         * 
         * Contains all required data needed
         */
        let d = await this.tryToDecideOnResponseOfData(input);


        /**
         * Days from t-p API response
         * 
         * Can contain days for requested year or
         * day for requested date
         * 
         * Empty array if no days were found
         * 
         * Undefined if days are found to be saved in the database
         */
        let days_obs: Observable<IDay[]> = undefined;

        if (d.country_code == undefined) {
            // country with specified name wasn't found
            // no day can be found
            d.e.country_name = es.addError(d.e.country_name, "not found");
        } else {
            if (d.country_year_found == false && d.region_year_found == false) {
                
                // set starting and ending dates
                let starting_date = undefined;
                let ending_date = undefined;

                if (input.req.day != undefined && input.req.day != undefined) {
                    // find one day by date
                    starting_date = ((input.req.day > 9) ? 
                        input.req.day
                        : ("0"+input.req.day)) 
                    + "-" + 
                    ((input.req.month > 9) ?
                        input.req.month
                        : ("0"+input.req.month))
                    + "-" + 
                    input.req.year;
                } else {
                    // find days for requested year
                    starting_date = "1-1-"+input.req.year;
                    ending_date = "31-12-"+input.req.year;
                }
                
                try {

                    // obtain days for requested year
                    // or 
                    days_obs = this.callendarService.getDay(
                        starting_date,
                        d.country_code,
                        d.region_code,
                        ending_date  
                    );

                } catch (e) {
                    return {
                        // identifies if method was called from hotload
                        hotload: (input.hotload == undefined)? 
                        false 
                        : (input.hotload == true) ? 
                            true 
                            : false,
                        country_year_found: d.country_year_found,
                        region_year_found: d.region_year_found,
                        // contains error if country wasn't found by name
                        error: e.response.error,
                        countries_update_promise: (d.country_name_not_found_case == undefined) ? 
                            d.countries_update_promise 
                            : d.country_name_not_found_case.countries_update_promise,
                        days_obs: undefined
                    }
                }
                
            }
        }

        return {
            // identifies if method was called from hotload
            hotload: (input.hotload == undefined)? 
                false 
                : (input.hotload == true) ? 
                    true 
                    : false,
            country_year_found: d.country_year_found,
            region_year_found: d.region_year_found,
            // contains error if country wasn't found by name
            error: (Object.entries(d.e).length === 0)? 
                undefined 
                : d.e,
            // promise to either create or update countries/regions found. provide some output
            countries_update_promise: (d.country_name_not_found_case == undefined) ? 
                d.countries_update_promise 
                : d.country_name_not_found_case.countries_update_promise,
            // days found from api
            days_obs: days_obs
        }
    }

    /**
     * Tries to decide from where the country code will be returned,
     * find if database require update or create promised using response data
     * 
     * @param input
     * @response 
     * - countries_update_promise - Promise to update/create countries
     *  - country_year_found - identification if days are saved in the database
     *  - region_year_found - identification if days are saved in the database
     *  - e - ITryLoadDaysError
     *  - country_name_not_found_case - contains country code and country update promise
     *  - country_code - which must have been updatained if any related data exist
     *  - region_code - from request
     * 
     */
    async tryToDecideOnResponseOfData(input: ITryLoadDays) {
        /**
         * Contains possible update promise,
         * that either creates or updates already existing
         * countries and their regions
         */
        let countries_update_promise: Promise<{
            savedCountries: Country[];
            savedRegions: Region[];
        }> | Promise<void> = undefined;

        /**
         * Identifies if days for requested year, country (and its regions)
         * are already saved in the database
         * 
         * Works if country_name is provided
         * instead of country_code
         */
        let country_year_found = false;
        /**
         * Identifies if days for requested year and region
         * are already saved in the database
         * 
         * Works if country_name is provided
         * instead of country_code
         */
        let region_year_found = false;

        
        /**
         * Error body
         * 
         * Used if coutry_name wasn't found in t-p API
         */
        let e: ITryLoadDaysError = new Object();

        /**
         * If country_name wasn't found in the database
         * it might have been found in the t-p API response
         * 
         * In which case this would contain update promise to 
         * make changes to the database.
         * 
         * country_code is only provided when changes were made
         */
        let country_name_not_found_case: {
            country_code: string;
            countries_update_promise: Promise<{
                savedCountries: Country[];
                savedRegions: Region[];
            }> | Promise<void>
        } = undefined;

        /**
         * Country code that will be used to make request to the t-p API
         */
        let country_code: string = undefined;
        /**
         * Region code that will be used to make request to the t-p API
         */
        let region_code: string = input.req.region_code;

        if (input.req.country_code == undefined) {
            // will require to pull data from the database to know country code
            if (input.db_country_ryi != undefined) {

                if (input.req.day == undefined && input.req.month == undefined) {
                    this.dateLimitsThrowService.tryThrowDatesLimits(
                        input.db_country_ryi.starting_date,
                        input.db_country_ryi.ending_date,
                        {
                            "day": input.req.day,
                            "month": input.req.month,
                            "year": input.req.year
                        }
                    );
                } else {
                    this.dateLimitsThrowService.tryThrowYearLimits(
                        input.db_country_ryi.starting_date,
                        input.db_country_ryi.ending_date,
                        input.req.year
                    );
                }

                let res = this.isYearOfDayCached(
                    input.req.year, 
                    input.db_country_ryi.country_years, 
                    input.db_country_ryi.region_years
                );

                country_year_found = res.country_year_found;
                region_year_found = res.region_year_found;
                
                country_code = input.db_country_ryi.country_code;

            } else {
                // country not found
                country_name_not_found_case = await this.tryGetCountryCodeFromApi(input.req.country_name).then(res => {
                    return res
                });
            }
        } else {
            country_code = input.req.country_code;
        }
        
        if (country_code == undefined) {
            if (country_name_not_found_case.country_code != undefined) {
                // update requested country_code to obtained
                country_code = country_name_not_found_case.country_code;
            } else {
                e.country_name = es.addError(e.country_name, "not found");
            }
        }
        
        return {
            countries_update_promise,
            country_year_found,
            region_year_found,
            e,
            country_name_not_found_case,
            country_code,
            region_code,
        }
    }

    /**
     * Checks if days are saved
     * 
     * Checks if found country (or its requested region) from the database, 
     * has full year of days saved
     * 
     * Finds region_id if region code was provided in the request
     * 
     * 
     * @param year 
     * @param country_years
     * @param region_years
     * @returns 
     */
     isYearOfDayCached(year: number, country_years: number[], region_years?: number[] | undefined) {
        let res = {
            country_year_found: false,
            region_year_found: false
        }

        // check country years
        
        if (country_years != null)
        for (let i=0; country_years.length; i++) {
            if (country_years[i] == year) {
                res.country_year_found = true;
                return res;
            }
        }
        

        // check region years
        if (region_years != null)
        for (let i=0; region_years.length; i++) {
            if (region_years[i] == year) {
                res.region_year_found = true;
                return res;
            }
        }
        
        // nothing found
        return res;
    }


    /**
     * Tries to find country code from third-party API by the country name
     * 
     * Creates save promise of all countries if no countries exist in the database
     * Create promise to update countries with new country/ies
     * 
     * @param country_name 
     * @returns has to await on countries_update_promise if such exists, ignore if country_code undefined
     */
    async tryGetCountryCodeFromApi(country_name: string) {
        // get all countries from database
        let countries_database_promise = this.countryEntityService.findAllWithRegions();
        // get all countries from response
        let countries_response = await lastValueFrom(this.callendarService.getCountries());

        let countries_update_promise: Promise<{
            savedCountries: Country[];
            savedRegions: Region[];
        }> | Promise<void> = undefined;

        let country_code: string = undefined;

        let lower_country_name = country_name.toLowerCase();

        let countries_database = await countries_database_promise;
        countries_database_promise = null;

        for (let i = 0; i < countries_response.length; i++) {

            if (countries_response[i].fullName.toLowerCase() == lower_country_name) {
                country_code = countries_response[i].countryCode;
                // here we know for sure, that countries in the database needs to be updated.
                if (countries_database.length == 0) {
                    countries_update_promise = this.countryEntityService
                        .saveAllNew(
                            countries_response
                        );
                    break;
                } else {
                    countries_update_promise = this.countryEntityService
                        .tryUpdateFromAPI(
                            countries_database,
                            countries_response
                        );
                    break;
                }
            }
        }
        return {country_code, countries_update_promise}
    }

}

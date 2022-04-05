import { ICountry, IDay } from "src/integrations/holiday_callendar_api/callendar.interface";
import { Country } from "src/models/country/country.entity";
import { ICountryEntityWithRegions, ISimpleDate } from "src/models/country/country.interface";
import { Day } from "src/models/day/day.entity";
import { Region } from "src/models/region/region.entity";

/**
 * CacheAroundDays input values
 * 
 * ---
 * - country_name
 * - country_code
 * - region_code
 * - year
 * ---
 * - rp_countries - is provided - create or update countries in the database with this list
 * - db_country_ryi - is not provided - collect from database, if not found from t-p API
 * ---
 * - db_days - is not provided - collect all days of requested year. ignores if empty array
 * - rp_days - is not provided - collect days by provided country code (and region) from t-p API.
 *  ignores if empty array
 * ---
 * - countries_update_promise - is provided - nullifies given db_country_ryi and gets it from the database
 * - operation_for_one_day - is provided - has to be true to only create or update ONE day 
 *  (not doing mitigate_days_response_difference since it is for saving whole year of days)
 * ---
 * - date_requested - operation_for_one_day and this is provided - create the day in the database
 * - db_day_for_one_day - operation_for_one_day and this is provided - update the given day in the database
 * with the day from the response
 * 
 * If **date_requested** is provided, will not check for **db_day_for_one day**
 */
export interface ICacheAroundDays {
    /**
     * Country name
     * 
     * Either country_code or country_name are required
     */
    country_name?: string | undefined,
    /**
     * Country code, prioritezed
     * 
     * Either country_code or country_name are required
     */
    country_code?: string | undefined,
    /**
     * Region code
     * 
     * Optional
     */
    region_code?: string | undefined,
    /**
     * Country list obtained from t-p API
     * 
     * If it is provided, create or update countries in the
     * database with this list (is not deleting)
     */
    rp_countries?: ICountry[] | undefined,
    /**
     * Countries from database with ryi (Region, Years and ids)
     * 
     * If not provided collect data from database
     */
    db_country_ryi?: ICountryEntityWithRegions | undefined,
    /**
     * Year of days requested 
     * 
     * Checks if days are saved under this year, when 
     * checking days cached years of country or region
     */
    year: number,
    /**
     * Days obtained from the database
     * 
     * If not provided, collects all days for specified year
     * from the database
     */
    db_days?: Day[] | undefined,
    /**
     * Days obtained from the t-p API response
     * 
     * If not provided will collect all days of requested 
     * country_code (and region_code) from the t-p API
     * 
     */
    rp_days?: IDay[] | undefined,
    /**
     * Update promise on countries and its regions
     * 
     * Must be awaited to update or create countries
     * 
     * If it is provided, then db_country_ryi is undefined
     * 
     * TODO it might be possible to use return data after update or creation
     * to not send additional request to the database.
     * Due to creation return, that doesn't have joins Country/Region, and
     * update response, that only sends the result of query, obtained value here
     * is ignored.
     */
    countries_update_promise?: Promise<void> | Promise<{
        savedCountries: Country[];
        savedRegions: Region[];
    }>, 

    /**
     * Identifies that if there's no day from response
     * it still is required to be saved as day
     * which is none_in... country or region
     * 
     */
    operation_for_one_day?: boolean,

    /**
     * Used for creating the day
     * 
     * If operation_for_one_day and this is provided only create the day
     */
    date_requested?: ISimpleDate,

    /**
     * Day that needs to be updated
     * 
     * If operation_for_one_day and this is provided only update the day
     */
    db_day_for_one_day?: Day
}
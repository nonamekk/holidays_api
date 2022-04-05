import { ICountry, IDay } from "src/integrations/holiday_callendar_api/callendar.interface";
import { Country } from "src/models/country/country.entity";
import { ICountryEntityWithRegions, ISimpleDate } from "src/models/country/country.interface";
import { Day } from "src/models/day/day.entity";
import { Region } from "src/models/region/region.entity";

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
     * country (and region) from the t-p API
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
     * Is required when operation_for_one_day is true
     * 
     * Used for creating new or updating day
     */
    date_requested?: ISimpleDate,

    /**
     * Day that needs to be updated
     * 
     * Required when operation_for_one_day is true
     */
    db_day_for_one_day?: Day
}
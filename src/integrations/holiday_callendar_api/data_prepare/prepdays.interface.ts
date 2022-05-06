import { Observable } from "rxjs";
import { Country } from "src/models/country/country.entity";
import { ICountryEntityWithRegions } from "src/models/country/country.interface";
import { Region } from "src/models/region/region.entity";
import { MonthDays } from "src/utilities/month_days_array/mda.type";
import { IDay } from "../callendar.interface";

/**
 * Input for tryLoadDays
 */
export interface ITryLoadDays {
    req: ITryLoadDaysRequested
    db_country_ryi?: ICountryEntityWithRegions | undefined,
    /**
     * Identifier if called with hotload
     */
    hotload?: boolean | undefined
} 

/**
 * Body for returning error (not found by country_name anywhere case)
 */
export interface ITryLoadDaysError {
    country_name?: string
}

/**
 * Requested data
 */
export interface ITryLoadDaysRequested {
    year: number,
    month?: number | undefined,
    day?: number | undefined,
    country_code?: string | undefined,
    country_name?: string | undefined,
    region_code?: string | undefined,
}

export interface ITryLoadDaysReturning {
    hotload: boolean,
    country_year_found: boolean,
    region_year_found: boolean,
    /**
     * Error
     * is any if returned from t-p API
     */
    error: any | ITryLoadDaysError | undefined,
    countries_update_promise: 
        Promise<{
            savedCountries: Country[];
            savedRegions: Region[];
        }> | 
        Promise<void> | 
        undefined,
    days_obs: Observable<IDay[]> | undefined
}

export interface ITryLoadHolidayDaysReturning {
    hotload: boolean,
    country_year_found: boolean,
    region_year_found: boolean,
    /**
     * Error
     * is any if returned from t-p API
     */
    error: any | ITryLoadDaysError | undefined,
    countries_update_promise: 
        Promise<{
            savedCountries: Country[];
            savedRegions: Region[];
        }> | 
        Promise<void> | 
        undefined,
    /**
     * Prepared observable that contains
     * - identifier if any days are present
     * - prepared for response list of months with holiday days 
     * - days originally returned
     */
    prep_obs: Observable<Promise<{
        containing_days: boolean;
        result: MonthDays[];
        days: IDay[];
    }>> | undefined
}
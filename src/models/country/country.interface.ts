import { Region } from "../region/region.entity"

export interface ICountryEntity {
    id?: number,
    code: string,
    full_name: string,
    years: number[] | null,
    workdays: boolean,

    from_date_year: number,
    from_date_month: number,
    from_date_day: number, 

    to_date_year: number,
    to_date_month: number,
    to_date_day: number
}

export interface ISimpleDate {
    day: number,
    month: number,
    year: number
}

/**
 * Country data from the database with ryi (region, years and ids)
 * 
 * Contains:
 * - country and region ids
 * - country and region codes
 * - country and region years
 * - date limits (starting and ending),
 * - all regions as entities,
 * - workdays identificator
 */
export interface ICountryEntityWithRegions {
    region_id?: number,
    region_years?: number[],
    region_code?: string,
    country_id: number,
    country_years: number[],
    country_code: string,
    country_name: string,
    starting_date: ISimpleDate,
    ending_date: ISimpleDate,
    workdays: boolean,
    regions: Region[]
}
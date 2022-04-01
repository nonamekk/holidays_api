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
    workdays: boolean
}
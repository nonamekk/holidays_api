export interface IStatusOfDayRequestError {
    day?: string | string[];
    month?: string | string[];
    year?: string | string[];

    country_name?: string | string[];

    country_code?: string | string[];

    region_code?: string | string[];
}

export interface IDayStatusDate {
    day: number,
    month: number,
    year: number
}
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
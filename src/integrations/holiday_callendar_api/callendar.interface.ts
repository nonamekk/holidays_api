import {WeekDay} from "../../models/day/day.type";

export interface IDay {
    date: IDate,
    holidayType: string
}

export interface IDate {
    year: number,
    month: number,
    day: number,
    dayOfWeek: number,
}

export interface ICountry {
    countryCode: string,
    regions: string[],
    fullName: string,
    fromDate: IDate,
    toDate: IDate,
    holidayTypes: string[]
}
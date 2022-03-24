// import { Country } from "../country/country.entity";
// import { Region } from "../region/region.entity";
import {WeekDay} from "./day.type";

export interface IDayEntity {
    id?: number,
    year?: number,
    month?: number,
    day?: number,
    day_of_week?: WeekDay,
    absolute?: boolean,
    holiday_in_countries_ids?: number[],
    workday_in_countries_ids?: number[],
    holiday_in_regions_ids?: number[],
    workday_in_regions_ids?: number[],
    none_in_countries_ids?: number[],
    none_in_regions_ids?: number[]
}
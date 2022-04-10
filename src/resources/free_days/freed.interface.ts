import { Observable } from "rxjs";
import { IDay } from "src/integrations/holiday_callendar_api/callendar.interface";
import { Country } from "src/models/country/country.entity";
import { Region } from "src/models/region/region.entity";
import { IHolidaysRequestError } from "../holidays/holidays.interface";

export interface IHotLoadedTry {
    hotload: boolean,
    error: any | IHolidaysRequestError,
    country_year_found: boolean,
    region_year_found: boolean,
    countries_update_promise: Promise<void> | Promise<{
        savedCountries: Country[];
        savedRegions: Region[];
    }>,
    days_obs: Observable<IDay[]> | undefined
}

/**IDay with its day number in year (1-365/366) */
export interface IDayWithDayNumber {
    day: IDay,
    day_number: number
}

// export interface IDayLight {
//     year: number,
//     month: number,
//     day: number,
//     week_day: number,
//     workday: boolean
// }

/**IDay with its day number array AND dim (Days In each Month)*/
export interface DaysAndDim {
    days: IDayWithDayNumber[],
    dim: number[]
}
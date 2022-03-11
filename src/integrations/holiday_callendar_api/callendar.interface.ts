
export interface IDay {
    date: IDate,
    holidayType: string
}

export interface IDate {
    year: number,
    month: number,
    day: number,
    // holiday can be a free day initially
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
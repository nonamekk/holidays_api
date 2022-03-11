import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { IDay, ICountry } from './callendar.interface';


@Injectable()
export class CallendarService {
  constructor(private httpService: HttpService) {}

  getCountries(): Observable<ICountry[]> {
    return this.httpService
        .get('https://kayaposoft.com/enrico/json/v2.0/?action=getSupportedCountries')
        .pipe(
            map((response) => response.data)
        );
  }

  getHolidaysForYear(country_code: string, year: number, region_code?: string): Observable<IDay[]> {
    // blantly can just make a request with region="" and don't make a check, it will work the same
    // check if region_code is undefined or ""
    let req: string = (!region_code) ?
        `https://kayaposoft.com/enrico/json/v2.0/?action=getHolidaysForYear&year=${year}&country=${country_code}&holidayType=public_holiday`
    : `https://kayaposoft.com/enrico/json/v2.0/?action=getHolidaysForYear&year=${year}&country=${country_code}&region=${region_code}&holidayType=public_holiday`;
    
    return this.httpService
        .get(req).pipe(
            map((response) => {return response.data})
        );
  }

  getAllForYear(country_code: string, year: number, region_code?: string): Observable<IDay[]> {

    let req: string = (!region_code) ?
        `https://kayaposoft.com/enrico/json/v2.0/?action=getHolidaysForYear&year=${year}&country=${country_code}`
    : `https://kayaposoft.com/enrico/json/v2.0/?action=getHolidaysForYear&year=${year}&country=${country_code}&region=${region_code}`;

    return this.httpService
        .get(req).pipe(
            map((response) => response.data.filter((day: { holidayType: string; }) => {
                return (day.holidayType == "public_holiday" || day.holidayType == "extra_working_day")
            }))
        );
    }

  getDay (date: string, country_code: string, region_code?: string): Observable<IDay[]> {
    let req: string = (!region_code) ?
        `https://kayaposoft.com/enrico/json/v2.0/?action=getHolidaysForDateRange&fromDate=${date}&toDate=${date}&country=${country_code}`
    : `https://kayaposoft.com/enrico/json/v2.0/?action=getHolidaysForDateRange&fromDate=${date}&toDate=${date}&country=${country_code}&region=${region_code}`;


    return this.httpService
        .get(req).pipe(
            map((response) => 
                response.data.filter((day: { holidayType: string; }) => {
                    return (day.holidayType == "public_holiday" || day.holidayType == "extra_working_day")
                })
            )
            // this is optional, decrease performance twice 
            // map((data) => 
            //     data.map((val) => {
            //         delete val.name
            //         return val
            //     })
            // )
        );
  }
}
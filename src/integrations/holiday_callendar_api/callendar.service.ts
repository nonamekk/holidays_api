import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { IDay, ICountry } from './callendar.interface';


@Injectable()
export class CallendarService {
  constructor(private httpService: HttpService) {}

  /**
   * Collects all available countries from the API
   * @returns data from response
   * @throws prepared HttpExeception with BAD_REQUEST and error from API
   */
  getCountries(): Observable<ICountry[]> {
    return this.httpService
        .get('https://kayaposoft.com/enrico/json/v2.0/?action=getSupportedCountries')
        .pipe(
            map((response) => {
                if (response.data.error != undefined) {
                    throw new HttpException({ "code": 400, "error": response.data.error }, HttpStatus.BAD_REQUEST)
                }
                
                return response.data
            })
        );
  }

  /**
   * Get list of holidays for desired country (and its region) by their codes and year
   * @param country_code 
   * @param year 
   * @param region_code 
   * @returns data from response 
   * @throws prepared HttpExeception with BAD_REQUEST and error from API
   */
  getHolidaysForYear(country_code: string, year: number, region_code?: string): Observable<IDay[]> {
    // blantly can just make a request with region="" and don't make a check, it will work the same
    // check if region_code is undefined or ""
    let req: string = (!region_code) ?
        `https://kayaposoft.com/enrico/json/v2.0/?action=getHolidaysForYear&year=${year}&country=${country_code}&holidayType=public_holiday`
    : `https://kayaposoft.com/enrico/json/v2.0/?action=getHolidaysForYear&year=${year}&country=${country_code}&region=${region_code}&holidayType=public_holiday`;
    
    return this.httpService
        .get(req).pipe(
            map((response) => {
                if (response.data.error != undefined) {
                    throw new HttpException({ "code": 400, "error": response.data.error }, HttpStatus.BAD_REQUEST)
                }

                return response.data
            })
        );
  }

  /**
   * Get list of workdays or holidays for desired country (and its region) by their codes and year
   * @param country_code 
   * @param year 
   * @param region_code 
   * @returns data from response
   * @throws prepared HttpExeception with BAD_REQUEST and error from API
   */
  getAllForYear(country_code: string, year: number, region_code?: string): Observable<IDay[]> {

    let req: string = (!region_code) ?
        `https://kayaposoft.com/enrico/json/v2.0/?action=getHolidaysForYear&year=${year}&country=${country_code}`
    : `https://kayaposoft.com/enrico/json/v2.0/?action=getHolidaysForYear&year=${year}&country=${country_code}&region=${region_code}`;

    return this.httpService
        .get(req).pipe(
            map((response) => { 
                if (response.data.error != undefined) {
                    throw new HttpException({ "code": 400, "error": response.data.error }, HttpStatus.BAD_REQUEST)
                }

                return response.data.filter((day: { holidayType: string; }) => {
                    return (day.holidayType == "public_holiday" || day.holidayType == "extra_working_day")
                })
            })
        );
    }

  /**
   * Get day info on a day for desired country (and its region) and date
   * @param from_date 
   * @param country_code 
   * @param region_code 
   * @returns array with day if it is holiday or workday (empty array otherwise)
   * @throws prepared HttpException with BAD_REQUEST if there's an error from API
   */
  getDay (from_date: string, country_code: string, region_code?: string, to_date?: string): Observable<IDay[]> {
    let req: string = (!region_code) ?
        `https://kayaposoft.com/enrico/json/v2.0/?action=getHolidaysForDateRange&fromDate=${from_date}&toDate=${(to_date == undefined)?from_date:to_date}&country=${country_code}`
    : `https://kayaposoft.com/enrico/json/v2.0/?action=getHolidaysForDateRange&fromDate=${from_date}&toDate=${(to_date == undefined)?from_date:to_date}&country=${country_code}&region=${region_code}`;


    return this.httpService
        .get(req).pipe(
            map((response) => {
                if (response.data.error != undefined) {
                    throw new HttpException({ "code": 400, "error": response.data.error }, HttpStatus.BAD_REQUEST)
                }

                return response.data.filter((day: { holidayType: string; }) => {
                    return (day.holidayType == "public_holiday" || day.holidayType == "extra_working_day")
                })
            })
        );
  }
}
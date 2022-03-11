import { HttpException, HttpStatus, Inject, Injectable} from "@nestjs/common";
import { MonthsEnum } from './holidays.enum';
import { HolidaysDtoRequest } from "./holidays.dto";
import { DayEntityService } from "src/models/day/day.service";
import { CallendarService } from "src/integrations/holiday_callendar_api/callendar.service";
import { CountryService } from "src/models/country/country.service";
import { ErrorService as es } from "src/errors/adderror.service";

import {IHolidaysRequestError} from "./holidays.interface";
import { DescriptorService } from "src/utilities/descriptor.service";
import { ConfigService } from "src/config/config.service";
import { lastValueFrom, map, Observable, tap } from "rxjs";
import { IMonthsObject } from "src/utilities/descriptor.interface";
import { ICountry, IDay } from "src/integrations/holiday_callendar_api/callendar.interface";
import { RegionEntityService } from "src/models/region/region.service";
import { CacherService } from "src/cacher/cacher.service";



@Injectable()
export class HolidaysResourceService {
    constructor(
        private readonly callendarService: CallendarService,
        private readonly countryEntityService: CountryService,
        private readonly configService: ConfigService,
        private readonly dayEntityService: DayEntityService,
        private readonly cacherService: CacherService
    ) {}

    validateRequest(req: HolidaysDtoRequest) {
        let errorMessages: string[] = [];
        if (req.country_code == undefined && req.country_name == undefined) {
            errorMessages.push("country_code or country_name are required");
        }
        if (req.year == undefined) {
            errorMessages.push("year is required")
        }
        if (errorMessages.length > 0) {
            if (errorMessages.length == 1) {
                throw new HttpException({"code": 400, "message": errorMessages[1], "error": "Bad Request"}, HttpStatus.BAD_REQUEST)
            } else throw new HttpException({"code": 400, "message": errorMessages, "error": "Bad Request"}, HttpStatus.BAD_REQUEST)
        }

        let e: IHolidaysRequestError = new Object();
        if (req.country_code != undefined) {
            if (req.country_code.length != 3) {
                e.country_code = es.addError(e.country_code, "can only be 3 characters long")
            }
            if (/[^a-zA-Z]/.test(req.country_code)) {
                e.country_code = es.addError(e.country_code, "can only be characters")
            }
        }
        if (req.region_code != undefined) {
            if (req.region_code.length != 2 && req.region_code.length != 3) {
                e.region_code = es.addError(e.region_code, "can only be 2-3 characters long")
            }
            if (/[^a-zA-Z ]/.test(req.region_code)) {
                e.region_code = es.addError(e.region_code, "can only be characters")
            }
        }
        if (req.country_name != undefined) {
            if (!(req.country_name.length > 2 && req.country_name.length < 32)) {
                e.country_name = es.addError(e.country_name, "can only be 2-32 characters long")
            }
            if (/[^a-zA-Z]/.test(req.country_name)) {
                e.country_name = es.addError(e.country_name, "can only be characters")
            }
        }
        if (req.year > 32767 || req.year < 0) {
            e.year = es.addError(e.year, "number can only be the size of smallint unsigned (0-32767)")
        } 

        if (Object.entries(e).length === 0) {
            return req
        } else {
            throw new HttpException({"code": 400, "message": e, "error": "Bad Request"}, HttpStatus.BAD_REQUEST)
        }
    }

    // containing days identifies if there're any days in the list. false = there're no days.
    prepareHolidaysFromCallendar(country_code: string, year: number, region_code?: string) {
        return this.callendarService.getHolidaysForYear(country_code, year, region_code)
            .pipe(
                map(days => {
                    let containing_days = true;
                    if (days.length == 0) {
                        containing_days = false;
                    }
                    let res = this.dayEntityService
                    .prepareHolidaysFromCallendarToResponse(days)
                        .then(result => {return {containing_days, result, days}});
                    return res;
                })
            )
    }

    async findCountryCodeUsingResponse(req: HolidaysDtoRequest, countries_response: ICountry[]) {
        let country_code = undefined;
        if (req.country_code == undefined && req.country_name != undefined) {
            // only has country name , try to find by code from API
            
            let country_name_lower = req.country_name.toLowerCase();

            for (let i=0; i<countries_response.length; i++) {
                if (countries_response[i].fullName.toLowerCase() == country_name_lower) {
                    country_code = countries_response[i].countryCode;
                    break;
                }
            }
                
            if (country_code == undefined) {
                throw new HttpException({
                    "code": 404,
                    "message": "No country was found following specified name",
                    "error": "Not Found"
                }, HttpStatus.NOT_FOUND);
            }
            
        } else {
            country_code = req.country_code;
        }
        return country_code;
    }

    async serveHolidaysList(req: HolidaysDtoRequest) {

        let daysForThisYear = this.dayEntityService.findByYearWithArrays(req.year);

        // If hotload is on, this will prepare holidays for each month from the API.
        // This can be served in case no data in the database.
        let holidayDaysListFromAPI = this.configService.getConfig().then(
            cfg => {
                let hotload: boolean = (cfg.settings.hotload);
                if (cfg.settings.hotload) {
                    if (req.country_code == undefined) {
                        // true, undefined
                        return {
                            "hotload": hotload, 
                            "list": null
                        };
                    } else {
                        let res = this.prepareHolidaysFromCallendar(req.country_code, req.year, req.region_code);
                        // true, promise<observable..>
                        return {
                            "hotload": hotload, 
                            "list": res
                        };
                    }
                    
                } else {
                    // false, undefined
                    return {
                        "hotload": hotload, 
                        "list": null
                    };
                }
            }
        );
        
        


        let countries_database = await this.countryEntityService.findByWithRegions(req.country_name, req.country_code, req.region_code);



        if (countries_database == null) {
            // no country and/or region were found in the database
            let countries_response = await lastValueFrom(this.callendarService.getCountries());
            let country_code = await this.findCountryCodeUsingResponse(req, countries_response);
                
                    
            let days_response = await lastValueFrom(this.callendarService.getHolidaysForYear(country_code, req.year, req.region_code));

            // console.log(days_response);
            if (days_response.length == 0) {
                throw new HttpException({
                    "code": 404,
                    "message": "No holidays were found following specified country name",
                    "error": "Not Found"
                }, HttpStatus.NOT_FOUND);
            } else {

                let holidaysOfMonths = await this.dayEntityService.prepareHolidaysFromCallendarToResponse(days_response);
                
                let obs = new Observable((o) => {
                    o.next(holidaysOfMonths);
                    o.complete();
                });
                return obs.pipe(tap(async ()=> {
                    // DO CACHE TO DATABASE>
                    await this.cacherService.cache(
                        countries_response, country_code, req.region_code, req.year, daysForThisYear
                    );
                }),
                map((x:IMonthsObject[])=> {
                    // console.log(x);
                    return x
                }));
            }
        } else {
            // country with regions was found.
            // country code must be defined

            let days_are_in_database = false;
            let year_in_country = false;
            let year_in_region = false;
            console.log(countries_database);
            
            if (countries_database.region_years != undefined) {
                // region provided    
                if (countries_database.region_years != null) {
                for (let i=0; countries_database.region_years.length; i++) {
                    if (countries_database.region_years[i] == req.year) {
                        days_are_in_database = true;
                        year_in_region;
                        break;
                    }
                }} else {
                    // no years in region_years
                }
                
            }
            if (!days_are_in_database) {
                if (countries_database.country_years != null) {
                for (let i=0; i<countries_database.country_years.length; i++) {
                    if (countries_database.country_years[i] == req.year) {
                        year_in_country = true;
                        days_are_in_database = true;
                    }
                }} else {
                    // no years in country_years
                }
                
            }

            if (days_are_in_database) {
                // make a request to the database
                let days = await daysForThisYear;
                // if (year_in_country) {
                //     // use country year find
                // } else {
                //     // use region year find
                // }
                
                return await this.dayEntityService.prepareHolidaysFromDatabaseToResponse(
                    days, countries_database.country_id, countries_database.region_id
                );
                
                // return false;
                
            } else {
                // use hotloaded values from api.
                let list: Observable<Promise<{
                    containing_days: boolean;
                    result: IMonthsObject[];
                    days: IDay[];
                }>> = undefined;

                if (req.country_code != undefined) {
                    let hotloaded = await holidayDaysListFromAPI;

                    if (hotloaded.hotload == true) {
                        // values were loaded.
                        list = hotloaded.list;
                    } else {
                        list = this.prepareHolidaysFromCallendar(countries_database.country_code, req.year, countries_database.region_code);
                    }
                } else {
                    list = this.prepareHolidaysFromCallendar(countries_database.country_code, req.year, countries_database.region_code);
                }
                

                
                


                if (list != null) {
                    return list.pipe(tap(async x=>{

                        await this.cacherService.cache(
                            undefined, countries_database.country_code, countries_database.region_code, req.year, daysForThisYear
                        );
                    }),
                    
                    map(async x => {
                        // console.log(x);
                        let a = await x;
                        if (a.containing_days == true) {
                            return a.result;
                        } else {
                            let message;
                            if (countries_database.region_code != undefined) {
                                message = "Can't find holidays for a year to specified country and region";
                            } else {
                                message = "Can't find holidays for a year to specified country";
                            }
                            
                            let err = new HttpException({
                                "code": 404,
                                "message": message,
                                "error": "Not Found"
                            }, HttpStatus.NOT_FOUND)
                            throw err
                        }
                    }));
    
                } else {
                    let message;
                    if (countries_database.region_code != undefined) {
                        message = "Can't find holidays for a year to specified country and region";
                    } else {
                        message = "Can't find holidays for a year to specified country";
                    }
                    
                    let err = new HttpException({
                        "code": 404,
                        "message": message,
                        "error": "Not Found"
                    }, HttpStatus.NOT_FOUND)
                    throw err
                }

            }
            
                    
        }
    }
}
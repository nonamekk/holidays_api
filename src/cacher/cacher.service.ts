import { Injectable } from "@nestjs/common";
import { lastValueFrom } from "rxjs";
import { ICountry } from "src/integrations/holiday_callendar_api/callendar.interface";
import { CallendarService } from "src/integrations/holiday_callendar_api/callendar.service";
import { Country } from "src/models/country/country.entity";
import { CountryEntityService } from "src/models/country/country.service";
import { Day } from "src/models/day/day.entity";
import { DayEntityService } from "src/models/day/day.service";
import { Region } from "src/models/region/region.entity";
import { RegionEntityService } from "src/models/region/region.service";


@Injectable()
export class CacherService {
    constructor(
        private readonly countryEntityService: CountryEntityService,
        private readonly callendarService: CallendarService,
        private readonly dayEntityService: DayEntityService,
        private readonly regionEntityService: RegionEntityService

    ) {}

    async cache(countries_response, country_code, region_code, year, daysForThisYear) {
        // ##############
        // Cache new countries if there's difference
        if (countries_response != undefined) {
            await this.try_cache_countries(countries_response);
        }
        
        

        // ##############
        // trying to find region entity if region code was provided.
        let countryEntity: Country = undefined;
        let regionEntity: Region = undefined;
        if (region_code != undefined) {
            let a = await this.find_region_and_country_entities(
                country_code, region_code);
            countryEntity = a.countryEntity;
            regionEntity = a.regionEntity;
        } else {
            countryEntity = await this.countryEntityService.findByCodeWithRegions(country_code);
        }
        
        let region_has_year = false;
        let country_has_year = false;
        if (regionEntity != undefined) {
            if (regionEntity.years != null) {
            for (let i=0; i<regionEntity.years.length; i++) {
                if (regionEntity.years[i] == year) {
                    region_has_year = true;
                }
            }} else {
                // region doesn't have any years
            }
            
        }
        if (!region_has_year) {
            if (countryEntity.years != null) {
            for(let i=0; i<countryEntity.years.length; i++) {
                if (countryEntity.years[i] == year) {
                    country_has_year = true;
                }
            }} else {
                // country doesn't have any years
            }
            
        }
        // ##############
        // year in country/region guarantees that these days were checked previously.
        
        let mitigation_days_response_diff_done = false;
        let days_database: Day[] = undefined;
        if (!country_has_year || !region_has_year) {
            // CACHING DAYS HERE.
            // creating new days response, containing holidays and workdays.

            // let a = await this.mitigate_days_response_difference(
            //     regionEntity, countryEntity, year, daysForThisYear
            // );
            await this.mitigate_days_response_difference(
                    regionEntity, countryEntity, year, daysForThisYear);
            mitigation_days_response_diff_done = true;
            // days_database = a.days_database;
        }
        
        // check if all regions are checked by the year
        // update years checked for country and/or region
        // updates days by removing region_id and adding country_id for holidays_in... and workdays_in...

        // FINALLY UPDATE COUNTRY TO HAVE YEARS, because workdays and holidays are found here.

        if (daysForThisYear == undefined) {
            days_database = await this.dayEntityService.findByYear(year)
        } else {
            if (mitigation_days_response_diff_done) {
                // there will be a difference with preloaded days for the year.
                days_database = await this.dayEntityService.findByYear(year)
            } else {
                days_database = await daysForThisYear
            }
        }
        
        days_database = await this.dayEntityService.findByYear(year);
        await this.mitigate_year(
            year, countryEntity, regionEntity, days_database
        );
    }
  
    async try_cache_countries(countries_response: ICountry[]) {
        let countries_database = await this.countryEntityService.findAllWithRegions();
            if (countries_database.length == 0) {
                await this.countryEntityService.saveAllNew(countries_response)
            } else {
                await this.countryEntityService.tryUpdateFromAPI(countries_database, countries_response)
            }
    }

    // more to utilities than to cache service
    async find_region_and_country_entities(country_code: string, region_code: string) {
        let countryEntity = await this.countryEntityService.findByCodeWithRegions(country_code);
        
        console.log(countryEntity);
        let regionEntity = undefined;
        if (region_code != undefined) {
            for (let i=0; i< countryEntity.regions.length; i++){
                console.log(countryEntity.regions[i]);
                if (countryEntity.regions[i].code == region_code) {
                    regionEntity = countryEntity.regions[i];
                }
            }
            if (regionEntity == undefined) {
                return null; // this should not happen, because database is synced with API and must countain same regions.
            }
            
        }
        console.log(countryEntity);
        return {
            "countryEntity":countryEntity,
            "regionEntity": regionEntity
        };
        // return {countryEntity, regionEntity};
    }

    async mitigate_days_response_difference(regionEntity:any, countryEntity: Country, year: number, daysForThisYear?: Promise<Day[]>) {
        let region_entity_code = (regionEntity == undefined) ? undefined : (regionEntity.code);
                    
        let days_response = await lastValueFrom(this.callendarService.getAllForYear(countryEntity.code, year, region_entity_code));
        let days_database = (daysForThisYear == undefined)?
            await this.dayEntityService.findByYearWithArrays(year)
        : await daysForThisYear;
        
        if (days_database.length == 0) {
            // if no days are saved in the database create new days
            let days = this.dayEntityService.create_array(days_response, countryEntity, regionEntity);
            await this.dayEntityService.saveArray(days);
        } else {
            // update if any are different
            console.log(regionEntity);
            await this.dayEntityService.updateDifferent(days_response, days_database, countryEntity, regionEntity);                                    
        }


        return {days_response, days_database};
    }

    async mitigate_year(year: number, countryEntity: Country, regionEntity: any, days_database: Day[]) {
        if (regionEntity != undefined) {
            // check each region to have a year.
            // if year is contained in all regions, except region requested
            // remove years from all regions and add it to country.
            // remove id's of regions from day and add country id to (holiday/workday in id's)
            

            let year_in_left_regions = false;

            // loop through all regions
            for (let i=0; i<countryEntity.regions.length; i++) {
                console.log(countryEntity.regions[i]);
                if (countryEntity.regions[i].code != regionEntity.code) {
                    if (countryEntity.regions[i].years != null) {

                        // loop through region years
                        for (let j=0; j<countryEntity.regions[i].years.length; j++) {
                            // find required region
                            console.log(countryEntity.regions[i].years[j])
                            if (countryEntity.regions[i].years[j] == year) {
                                year_in_left_regions = true;
                                break;
                            }
                            
                        }
                        if (!year_in_left_regions) {
                            year_in_left_regions = false;
                            break;
                        }

                    } else {
                        year_in_left_regions = false;
                        break;
                    }
                }
                // if region has years
                
            }
            console.log(year_in_left_regions);
            if (year_in_left_regions) {
                // already cached days for all of the regions.

                // remove year from each region
                // add year to country
                for (let i=0; i<countryEntity.regions.length; i++) {
                    let updated_list = [];
                    if (countryEntity.regions[i].years != null) {
                        for (let j=0; j<countryEntity.regions[i].years.length; j++) {
                            if (countryEntity.regions[i].years[j] != year) {
                                updated_list.push(countryEntity.regions[i].years[j])
                                
                            }
                        }
                        countryEntity.regions[i].years = updated_list;
                        await this.regionEntityService.update(countryEntity.regions[i]);
                    } else {
                        // we found the requested region, which will not be updated
                        // no years specified for this region
                    }

                }
                
                await this.countryEntityService.add_year(countryEntity, year);
                    // now update every day and 
                    // remove occurences of region_id
                    // add occurence of country_id
                   
                // this was a mistake. should not remove all region_ids and add country_id in days.    
                // await this.dayEntityService.replace_regions_to_country_id(countryEntity, days_database)
                

            } else {
                // add year only to current region
                
                for (let i=0; i<countryEntity.regions.length; i++) {
                    if (countryEntity.regions[i].code == regionEntity.code) {
                        // *check for array length here also> as else if?
                        if (countryEntity.regions[i].years == null) { 
                            countryEntity.regions[i].years = [year];
                        } else {
                            countryEntity.regions[i].years.push(year);
                        }
                        let a = await this.regionEntityService.update(countryEntity.regions[i]);
                        console.log(a);
                    }
                }
                
            }
        } else {
            await this.countryEntityService.add_year(countryEntity, year);
        }
        // add year to country years as  checked year
        
    }
}

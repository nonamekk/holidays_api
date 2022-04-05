import { Injectable } from "@nestjs/common";
import { lastValueFrom, Observable } from "rxjs";
import { ICountry, IDay } from "src/integrations/holiday_callendar_api/callendar.interface";
import { CallendarService } from "src/integrations/holiday_callendar_api/callendar.service";
import { Country } from "src/models/country/country.entity";
import { ICountryEntityWithRegions } from "src/models/country/country.interface";
import { CountryEntityService } from "src/models/country/country.service";
import { Day } from "src/models/day/day.entity";
import { DayEntityService } from "src/models/day/day.service";
import { Region } from "src/models/region/region.entity";
import { RegionEntityService } from "src/models/region/region.service";
import { ListingService } from "src/utilities/listing.service";
import { ICacheAroundDays } from "./cacher.interface";


@Injectable()
export class CacherService {
    constructor(
        private readonly countryEntityService: CountryEntityService,
        private readonly callendarService: CallendarService,
        private readonly dayEntityService: DayEntityService,
        private readonly regionEntityService: RegionEntityService,
        private readonly ls: ListingService

    ) {}

    // /**
    //  * Based on days and country/region - updates and creates countries/regions and days
    //  * 
    //  * Gets days from t-p API when tries to mitigate, where tries to create or update days
    //  * If countries_response not given, makes a request to the t-p API to get all of them
    //  * 
    //  * Caches countries, regions, days, updates cached year if days are provided.
    //  * Obtains all data about the country entity from the database
    //  * 
    //  * Removes region_ids from lists and adds country_id instead 
    //  * if all regions are contained under one list category (holiday_in..., workday_in...)
    //  * 
    //  * @param countries_response countries from t-p API, if not set make a request to the t-p API
    //  * @param country_code which is used to make request to the t-p API to find days
    //  * @param region_code optional code to find by
    //  * @param year 
    //  * @param db_days is used when some days were found and might require an update, when compared to days from t-p API
    //  * @param response_days if not set, request days from t-p API
    //  */
    // async cache_around_days(
    //     countries_response: ICountry[] | undefined, 
    //     country_code: string, 
    //     region_code: string | undefined, 
    //     year: number, 
    //     db_days: Promise<Day[]> | undefined, 
    //     response_days?:IDay[] | undefined
    //     ) {
    //     // Cache new countries if there's difference
    //     // after this is done, all countries must be in the database
    //         // it may be skipped if we are sure, that the country is in the database
    //         // in which case country_code and region_code must be from the database
    //     if (countries_response != undefined) {
    //         await this.try_cache_countries(countries_response);
    //     }

    //     let res = await this.countryEntityService.findByWithRegions();
        
    //     // finding saved enitities from the database
    //     let countryEntity: Country = undefined;
    //     let regionEntity: Region = undefined;

    //     if (region_code != undefined) {
    //         // trying to find region entity from the db
    //         let a = await this.find_region_and_country_entities(
    //             country_code, region_code);
    //         countryEntity = a.countryEntity;
    //         regionEntity = a.regionEntity;
    //     } else {
    //         countryEntity = await this.countryEntityService.findByCodeWithRegions(country_code);
    //     }
        
    //     // check if country or region has days saved under the year which was originally requested by user
    //     let region_has_year = false;
    //     let country_has_year = false;
    //     if (regionEntity != undefined) {
    //         if (regionEntity.years != null) {
    //         for (let i=0; i<regionEntity.years.length; i++) {
    //             if (regionEntity.years[i] == year) {
    //                 region_has_year = true;
    //             }
    //         }} else {
    //             // region doesn't have any years
    //         }
            
    //     }
    //     if (!region_has_year) {
    //         if (countryEntity.years != null) {
    //         for(let i=0; i<countryEntity.years.length; i++) {
    //             if (countryEntity.years[i] == year) {
    //                 country_has_year = true;
    //             }
    //         }} else {
    //             // country doesn't have any years
    //         }
            
    //     }

    //     // year in country/region guarantees that these days were checked previously.
    //     // if years were not found, update days and country/region
    //     if (country_has_year == false || region_has_year == false) {
    //         await this.mitigate_days_response_difference(
    //                 (regionEntity == undefined)?
    //                     undefined
    //                 : regionEntity.code ,
    //                 (regionEntity == undefined)?
    //                     undefined
    //                 : regionEntity.id, 
    //                 countryEntity.id,
    //                 countryEntity.code,
    //                 countryEntity.regions, 
    //                 year, 
    //                 (db_days == undefined)?
    //                     undefined
    //                 : (await db_days), 
    //                 response_days
    //             );
    //     }
        
    //     await this.mitigate_year_of_owner(
    //         year, 
    //         countryEntity.id,
    //         countryEntity.regions,
    //         countryEntity.years, 
    //         (regionEntity == undefined)?
    //             undefined
    //         : regionEntity.code
    //     );
    // }


    // async getCountryRegionEntities(year: number, country_code: string, region_code?: string) {
    //     // finding saved enitities from the database
    //     let countryEntity: Country = undefined;
    //     let regionEntity: Region = undefined;

    //     if (region_code != undefined) {
    //         // trying to find region entity from the db
    //         let a = await this.find_region_and_country_entities(
    //             country_code, region_code);
    //         countryEntity = a.countryEntity;
    //         regionEntity = a.regionEntity;
    //     } else {
    //         countryEntity = await this.countryEntityService.findByCodeWithRegions(country_code);
    //     }
        
    //     // check if country or region has days saved under the year which was originally requested by user
    //     let region_has_year = false;
    //     let country_has_year = false;
    //     if (regionEntity != undefined) {
    //         if (regionEntity.years != null) {
    //         for (let i=0; i<regionEntity.years.length; i++) {
    //             if (regionEntity.years[i] == year) {
    //                 region_has_year = true;
    //             }
    //         }} else {
    //             // region doesn't have any years
    //         }
            
    //     }
    //     if (!region_has_year) {
    //         if (countryEntity.years != null) {
    //         for(let i=0; i<countryEntity.years.length; i++) {
    //             if (countryEntity.years[i] == year) {
    //                 country_has_year = true;
    //             }
    //         }} else {
    //             // country doesn't have any years
    //         }
            
    //     }
    //     return {countryEntity, regionEntity, country_has_year, region_has_year}
    // }

     /**
     * Checks if return was from update or creation of countries/regions
     * 
     * Since there's no jointable link between saved countries and regions
     * data provided cannot be further used, which means call to the database will be required
     * 
     * This function determines, what happened
     * @param res 
     * @returns 
     */
      isResponseAfterCreate(res: any) {
        try {
            let o = (res as {
                savedCountries: Country[];
                savedRegions: Region[];
            }).savedCountries;
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Updates or creates days in the database, 
     * 
     * saves identications that days for year are saved or
     * takes identications from all regions if all regions
     * have days saved and saves it under country 
     * 
     * identification is the cached_year
     * 
     * Pools country/region from database, 
     * if previous manipulations with it were identified
     * (new were created or old were updated by chance)
     * 
     * @param country_name required to find from database
     * @param country_code required to find from database
     * @param region_code required to find from database
     * @param db_country_ryi db_country from database with ryi (regions, years and ids)
     * @param year requested year
     * @param db_days days from database, if found any. 
     * @param response_days days from response, if was made ever
     * @param create_of_data countries were just created
     * @param update_in_data countries were just updated
     */
    async cacheAroundDays(
        input: ICacheAroundDays
        // create_of_data?: boolean | undefined,
        // update_in_data?: boolean | undefined

        // good idea to use data from creation response, but cuurent has no relation from jointable
        // allSavedCountries: Country[]
        // allSavedRegions: Region[]
    ) {

        if (input.countries_update_promise != undefined) {
            (this.isResponseAfterCreate(await input.countries_update_promise))
            // can obtain the difference on if countries were just created or new were added
            // in either way return from promise, cannot be used here
            
            // even if countries from database were provided, 
            // they need to be updated from the database

            input.db_country_ryi = undefined;
        }

        if (input.rp_countries != undefined) {
            // update or create countries with regions in the database first
            await this.try_cache_countries(input.rp_countries);
        }

        // <removed>
        // if country data was ever created or updated pull fresh data from the database
        // good idea to use data from creation response, but current version has no relation from jointable
        // if (create_of_data != undefined || update_in_data != undefined) {
        //     if (create_of_data == true || update_in_data == true) {
        //         db_country_ryi = await this.countryEntityService.findByWithRegions(country_code, country_name, region_code)
        //     }
        // }
        // </removed>

        if (input.db_country_ryi == undefined) {
            input.db_country_ryi = await this.countryEntityService.findByWithRegions(
                input.country_name, 
                input.country_code, 
                input.region_code
            );
        }

        if (input.db_country_ryi == null) {
            await this.try_cache_countries(
                await lastValueFrom(
                    this.callendarService.getCountries()
                )
            );
            input.db_country_ryi = await this.countryEntityService.findByWithRegions(
                input.country_name, 
                input.country_code, 
                input.region_code
            );
        }

        if (input.db_country_ryi != undefined) {
            // at this point country_with_regions cannot be undefined
            // check if country or region has year
            let country_has_year = this.ls.doesListContainValue(
                input.db_country_ryi.country_years, 
                input.year
            );
            let region_has_year = this.ls.doesListContainValue(
                input.db_country_ryi.region_years, 
                input.year
            );

            if (country_has_year == false && region_has_year == false) {

                // if operation is required only for one day
                if (input.operation_for_one_day != undefined) {
                    if (input.operation_for_one_day == true) {
                        if (input.db_days == undefined) {
                            // create new day
                            // don't check any days on if they are totalled, because there're none
                            if (input.date_requested != undefined) {
                                if (input.db_day_for_one_day != undefined) {
                                    await this.dayEntityService.updateOneDayFromResponse(
                                        input.rp_days[0],
                                        input.db_day_for_one_day,
                                        input.db_country_ryi.country_id,
                                        input.db_country_ryi.regions,
                                        input.db_country_ryi.country_years,
                                        input.db_country_ryi.region_id
                                    );
                                } else {
                                    await this.dayEntityService.createOneDayFromResponse(
                                        input.rp_days[0],
                                        input.date_requested,
                                        input.db_country_ryi.country_id,
                                        input.db_country_ryi.region_id
                                    );
                                }
                                
                            }
                            
                        } 
                    }
                } else {
                    // years not found -> update days or create new days with country/region ids in holiday_in.. or workday_in..
                    await this.mitigate_days_response_difference(
                        input.db_country_ryi.region_code,
                        input.db_country_ryi.region_id,
                        input.db_country_ryi.country_id,
                        input.db_country_ryi.country_code,
                        input.db_country_ryi.regions,
                        input.year,
                        input.db_days,
                        input.rp_days
                    );
                }
            }
            
            if (input.operation_for_one_day == undefined &&
                input.db_day_for_one_day == undefined &&
                input.date_requested == undefined) {
                // adds cached year under country (or region if not all days from region are saved)
                // removes cached year from all regions if it was found in all -> adds a year to country 
                await this.mitigate_year_of_owner(
                    input.year,
                    input.db_country_ryi.country_id,
                    input.db_country_ryi.regions,
                    input.db_country_ryi.country_years,
                    input.db_country_ryi.region_code,
                );
            } 
            
        }
    }
  
    async try_cache_countries(countries_response: ICountry[]) {
        let countries_database = await this.countryEntityService.findAllWithRegions();
            if (countries_database.length == 0) {
                await this.countryEntityService.saveAllNew(countries_response)
            } else {
                await this.countryEntityService.tryUpdateFromAPI(countries_database, countries_response)
            }
    }

    /**
     * Finds region and country entities from the database using codes
     * @param country_code 
     * @param region_code 
     * @returns 
     */
    async find_region_and_country_entities(country_code: string, region_code: string) {
        let countryEntity = await this.countryEntityService.findByCodeWithRegions(country_code);
        
        let regionEntity = undefined;
        if (region_code != undefined) {
            for (let i=0; i< countryEntity.regions.length; i++){
                if (countryEntity.regions[i].code == region_code) {
                    regionEntity = countryEntity.regions[i];
                }
            }
            if (regionEntity == undefined) {
                return null; // this should not happen, because database is synced with API and must countain same regions.
            }
            
        }

        return {
            "countryEntity":countryEntity,
            "regionEntity": regionEntity
        };
    }
    

    /**
     * Creates new days if none were saved, updates days from the t-p API
     * 
     * Makes a request to find days by year to the t-p API
     * 
     * @param region_code 
     * @param region_id 
     * @param country_id 
     * @param country_code 
     * @param country_regions regions entitity of country
     * @param year 
     * @param db_days database days
     * @param rp_days response days
     */
    async mitigate_days_response_difference(
        region_code: string | undefined, 
        region_id: number | undefined,
        country_id: number,
        country_code: string,
        country_regions: Region[], 
        year: number, 
        db_days?: Day[] | undefined, 
        rp_days?: IDay[] | Promise<IDay[]> | undefined
    ) {
                    
        // if it is a response it will be awaited, if it is IDay no effect will be taken
        if (rp_days == undefined) {
            rp_days = lastValueFrom(this.callendarService.getAllForYear(country_code, year, region_code))
        }
        
        // responses from database are faster, so we will save 15ms here
        if (db_days == undefined) {
            db_days = await this.dayEntityService.findByYear(year)
        }
        
        if (db_days.length == 0) {
            // no days are saved in the database 
            // create new days
            let days = this.dayEntityService.create_array(
                (await rp_days), 
                country_id, 
                (region_id)
            );
            if (days.length > 0) {
                await this.dayEntityService.saveArray(days);
            }
        } else {
            // update if any are different
            await this.dayEntityService.updateDifferent(
                (await rp_days), 
                db_days, 
                country_id,
                country_regions, 
                (region_id)
            );                                    
        }
    }


    /**
     * Check if all region_ids are saved for the year, takes cached year from
     * regions to country, by updating regions and country
     * @param year 
     * @param countryEntity 
     * @param regionEntity 
     * @param days_database 
     */
    async mitigate_year_of_owner(
        year: number, 
        countryEntity_id: number,
        countryEntity_regions: Region[],
        countryEntity_years: number[] | undefined | null,
        regionEntity_code?: string
    ) {
        if (regionEntity_code != undefined) {
            // check each region to have a year.
            // if year is contained in all regions, except region requested
            // remove years from all regions and add it to country.
            // remove id's of regions from day and add country id to (holiday/workday in id's)
            

            let year_in_left_regions = false;

            // loop through all regions
            for (let i=0; i<countryEntity_regions.length; i++) {
                
                if (countryEntity_regions[i].code != regionEntity_code) {
                    if (countryEntity_regions[i].years != null) {

                        // loop through region years
                        for (let j=0; j<countryEntity_regions[i].years.length; j++) {
                            // find required region
                            
                            if (countryEntity_regions[i].years[j] == year) {
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

            if (year_in_left_regions) {
                // already cached days for all of the regions.

                // remove year from each region
                // add year to country
                for (let i=0; i<countryEntity_regions.length; i++) {
                    let updated_list = [];
                    if (countryEntity_regions[i].years != null) {
                        for (let j=0; j<countryEntity_regions[i].years.length; j++) {
                            if (countryEntity_regions[i].years[j] != year) {
                                updated_list.push(countryEntity_regions[i].years[j])
                                
                            }
                        }
                        countryEntity_regions[i].years = updated_list;
                        await this.regionEntityService.update(
                            countryEntity_regions[i].id, 
                            countryEntity_regions[i].years, 
                            countryEntity_regions[i].code);
                    } else {
                        // we found the requested region, which will not be updated
                        // no years specified for this region
                    }

                }
                
                await this.countryEntityService.add_year(countryEntity_id, countryEntity_years, year);
                    // now update every day and 
                    // remove occurences of region_id
                    // add occurence of country_id
                   
                // this was a mistake. should not remove all region_ids and add country_id in days.    
                // await this.dayEntityService.replace_regions_to_country_id(countryEntity, days_database)
                

            } else {
                // add year only to current region
                
                for (let i=0; i<countryEntity_regions.length; i++) {
                    if (countryEntity_regions[i].code == regionEntity_code) {
                        // *check for array length here also> as else if?
                        if (countryEntity_regions[i].years == null) { 
                            countryEntity_regions[i].years = [year];
                        } else {
                            countryEntity_regions[i].years.push(year);
                        }
                        let a = await this.regionEntityService.update(
                            countryEntity_regions[i].id, 
                            countryEntity_regions[i].years,
                            countryEntity_regions[i].code
                        );
                    }
                }
                
            }
        } else {
            await this.countryEntityService.add_year(countryEntity_id, countryEntity_years, year);
        }
        // add year to country years as  checked year
        
    }
}

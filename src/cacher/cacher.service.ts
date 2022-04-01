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


@Injectable()
export class CacherService {
    constructor(
        private readonly countryEntityService: CountryEntityService,
        private readonly callendarService: CallendarService,
        private readonly dayEntityService: DayEntityService,
        private readonly regionEntityService: RegionEntityService,
        private readonly ls: ListingService

    ) {}

    /**
     * Based on days and country/region - updates and creates countries/regions and days
     * 
     * Gets days from t-p API when tries to mitigate, where tries to create or update days
     * If countries_response not given, makes a request to the t-p API to get all of them
     * Updates 
     * 
     * Caches countries, regions, days, updates cached year if days are provided.
     * Obtains all data about the country entity from the database
     * 
     * Removes region_ids from lists and adds country_id instead 
     * if all regions are contained under one list category (holiday_in..., workday_in...)
     * 
     * @param countries_response countries from t-p API, if not set make a request to the t-p API
     * @param country_code which is used to make request to the t-p API to find days
     * @param region_code optional code to find by
     * @param year 
     * @param db_days is used when some days were found and might require an update, when compared to days from t-p API
     * @param response_days if not set, request days from t-p API
     */
    async cache_around_days(
        countries_response: ICountry[] | undefined, 
        country_code: string, 
        region_code: string | undefined, 
        year: number, 
        db_days: Promise<Day[]> | undefined, 
        response_days?:IDay[] | undefined
        ) {
        // Cache new countries if there's difference
        // after this is done, all countries must be in the database
            // it may be skipped if we are sure, that the country is in the database
            // in which case country_code and region_code must be from the database
        if (countries_response != undefined) {
            await this.try_cache_countries(countries_response);
        }
        
        // finding saved enitities from the database
        let countryEntity: Country = undefined;
        let regionEntity: Region = undefined;

        if (region_code != undefined) {
            // trying to find region entity from the db
            let a = await this.find_region_and_country_entities(
                country_code, region_code);
            countryEntity = a.countryEntity;
            regionEntity = a.regionEntity;
        } else {
            countryEntity = await this.countryEntityService.findByCodeWithRegions(country_code);
        }
        
        // check if country or region has days saved under the year which was originally requested by user
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

        // year in country/region guarantees that these days were checked previously.
        // if years were not found, update days and country/region
        if (country_has_year == false || region_has_year == false) {
            await this.mitigate_days_response_difference(
                    (regionEntity == undefined)?
                        undefined
                    : regionEntity.code ,
                    (regionEntity == undefined)?
                        undefined
                    : regionEntity.id, 
                    countryEntity.id,
                    countryEntity.code,
                    countryEntity.regions, 
                    year, 
                    (db_days == undefined)?
                        undefined
                    : (await db_days), 
                    response_days
                );
        }
        
        await this.mitigate_year_of_owner(
            year, 
            countryEntity.id,
            countryEntity.regions,
            countryEntity.years, 
            (regionEntity == undefined)?
                undefined
            : regionEntity.code
        );
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
     * @param country_with_regions prepared data with years, ids and regions list
     * @param year requested year
     * @param db_days days from database, if found any
     * @param response_days days from response, if was made ever
     * @param create_of_data countries were just created
     * @param update_in_data countries were just updated
     */
    async cacheAroundDays_withYears(
        country_name: string | undefined,
        country_code: string | undefined,
        region_code: string | undefined,
        country_with_regions: ICountryEntityWithRegions | undefined,
        year: number,
        db_days:Day[] | undefined,
        response_days?: IDay[] | undefined,
        create_of_data?: boolean | undefined,
        
        update_in_data?: boolean | undefined

        // good idea to use data from creation response, but cuurent has no relation from jointable
        // allSavedCountries: Country[]
        // allSavedRegions: Region[]
    ) {
        // if country data was ever created or updated pull fresh data from the database
        // good idea to use data from creation response, but current version has no relation from jointable
        if (create_of_data != undefined || update_in_data != undefined) {
            if (create_of_data == true || update_in_data == true) {
                country_with_regions = await this.countryEntityService.findByWithRegions(country_code, country_name, region_code)
            }
        }

        // at this point country_with_regions cannot be undefined
        // check if country or region has year
        let country_has_year = false;
        let region_has_year = false;
        if (country_with_regions.country_years != null) {
            country_has_year = this.ls.doesListContainValue(country_with_regions.country_years, year);
        }
        if (!country_has_year) {
            region_has_year = this.ls.doesListContainValue(country_with_regions.region_years, year);
        }

        if (country_has_year == false && region_has_year == false) {
            // years not found -> update days or create new days with country/region ids in holiday_in.. or workday_in..
            this.mitigate_days_response_difference(
                country_with_regions.region_code,
                country_with_regions.region_id,
                country_with_regions.country_id,
                country_with_regions.country_code,
                country_with_regions.regions,
                year,
                db_days,
                response_days
            )
        }
       // adds cached year under country (or region if not all days from region are saved)
       // removes cached year from all regions if it was found in all -> adds a year to country 
        this.mitigate_year_of_owner(
            year,
            country_with_regions.country_id,
            country_with_regions.regions,
            country_with_regions.country_years,
            country_with_regions.region_code,
        )

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
        // return {countryEntity, regionEntity};
    }

    /**
     * Creates new days if none were saved, updates days from the t-p API
     * Makes a request to find days by year to the t-p API
     * 
     * @param regionEntity 
     * @param countryEntity 
     * @param year 
     * @param db_days 
     * @returns days from response and days from the database
     */
    async mitigate_days_response_difference(
        regionEntity_code: string | undefined, 
        regionEntity_id: number | undefined,
        countryEntity_id: number,
        countryEntity_code: string,
        countryEntity_regions: Region[], 
        year: number, 
        db_days?: Day[] | undefined, 
        response_days?: IDay[] | undefined
    ) {
                    
        // if it is a response it will be awaited, if it is IDay no effect will be taken
        let days_response = (response_days == undefined)?
            lastValueFrom(this.callendarService.getAllForYear(countryEntity_code, year, regionEntity_code))
        : response_days;
        response_days = null;
        
        let days_database = (db_days == undefined)?
            this.dayEntityService.findByYear(year)
        : db_days;
        db_days = null;
        
        if ((await days_database).length == 0) {
            // if no days are saved in the database create new days
            let days = this.dayEntityService.create_array(
                (await days_response), 
                countryEntity_id, 
                (regionEntity_id)
            );
            await this.dayEntityService.saveArray(days);
        } else {
            // update if any are different
            await this.dayEntityService.updateDifferent(
                (await days_response), 
                (await days_database), 
                countryEntity_id,
                countryEntity_regions, 
                (regionEntity_id)
            );                                    
        }


        return {days_response, days_database};
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

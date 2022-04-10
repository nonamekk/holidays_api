import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { Repository, UpdateResult } from 'typeorm';
import { Country } from './country.entity';
import { ICountry } from '../../integrations/holiday_callendar_api/callendar.interface';
import { ICountryEntity, ICountryEntityWithRegions } from './country.interface'
import { RegionEntityService } from '../region/region.service';

@Injectable()
export class CountryEntityService {
  constructor(
    @Inject('COUNTRY_REPOSITORY')
    private countryRepository: Repository<Country>,
    private readonly regionEntityService: RegionEntityService

  ) {}

  /**
   * Finds all countries entities without their regions entities
   * 
   * Can only be used if regions are not required,
   * if regions are required use **findAllWithRegions**
   * @returns 
   */
  async findAll() {
    return this.countryRepository.find();
  }

  /**
   * Finds all countries entities with their regions
   * @returns 
   */
  async findAllWithRegions() {
    return this.countryRepository.find({relations: ["regions"]});
  }

  /**
   * Finds country entity with its regions by code
   * 
   * if you need country data with regions, **findByWithRegions** 
   * is preferred
   * 
   * @param country_code 
   * @returns 
   */
  async findByCodeWithRegions(country_code: string) {
    let lower = country_code.toLowerCase();
    return this.countryRepository
      .createQueryBuilder("country")
      .leftJoinAndSelect("country.regions", "region")
      .where("country.code = :code", {code: lower})
      .getOne();
  }

  /**
   * Finds country entity with its regions by name
   * 
   * if you need country data with regions, **findByWithRegions** 
   * is preferred
   * 
   * @param country_name 
   * @returns 
   */
  async findByNameWithRegions(country_name: string) {
    let lower = country_name.toLowerCase();
    return this.countryRepository
      .createQueryBuilder("country")
      .leftJoinAndSelect("country.regions", "region")
      .where("LOWER(country.full_name) = :name", {name: lower})
      .getOne();
  }

  /**
   * Gets country_ryi from the database
   * 
   * country_ryi - Country with Regions, Ids, Years
   * 
   * Contains:
   *  - ids of country (and region)
   *  - name of country
   *  - codes of country (and region)
   *  - starting date (from which days must be present in the t-p API)
   *  - ending date (from which days must be present in the t-p API)
   *  - workdays identifier (true if workdays are enabled for country)
   *  - regions list (as region entities originally from database)
   * 
   * @param country_name either name or code is required
   * @param country_code either name or code is required
   * @param region_code optional
   * @throws HttpException with **InternalServerError**, 
   * must never be thrown if function is with correct input of *country_code/country_name*
   * @returns 
   */
  async findByWithRegions(country_name?: string, country_code?: string, region_code?: string): Promise<ICountryEntityWithRegions> {
    region_code = (region_code != undefined)?region_code.toLowerCase():undefined;
    let query: Promise<Country>;

    if (country_code === undefined && country_name === undefined) {
      // expected this to be internal problem, validation must cover this as bad request.
      throw new HttpException('country_name or country_code were not provided', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (country_code !== undefined) {
      query = this.findByCodeWithRegions(country_code)
    } else {
      query = this.findByNameWithRegions(country_name)
    }


    return query.then(
      x => {
        if (x == undefined || x == null) {
          return null;
        }
        // console.log(x);
        for (let i = 0; i< x.regions.length; i++) {
          if (x.regions[i].code == region_code) {
              return {
                "region_id": x.regions[i].id,
                "region_years": x.regions[i].years,
                "region_code": x.regions[i].code,

                "country_id": x.id,
                "country_years": x.years,
                "country_code": x.code,
                "country_name": x.full_name,
                "starting_date": {
                  day: x.from_date_day,
                  month: x.from_date_month,
                  year: x.from_date_year
                },
                "ending_date": {
                  day: x.to_date_day,
                  month: x.to_date_month,
                  year: x.to_date_year
                },
                workdays: (x.workdays),
                regions: x.regions
              }
          }
        }
        return {
          "country_id": x.id,
          "country_years": x.years,
          "country_code": x.code,
          "country_name": x.full_name,
          "starting_date": {
            day: x.from_date_day,
            month: x.from_date_month,
            year: x.from_date_year
          },
          "ending_date": {
            day: x.to_date_day,
            month: x.to_date_month,
            year: x.to_date_year
          },
          workdays: (x.workdays),
          regions: x.regions
        }
      }
    )
  }

  /**
   * Finds country with regions by id
   * 
   * using queryBuilder
   * @param id 
   * @returns 
   */
  async findByIdWithRegions(id: number) {
    return this.countryRepository
      .createQueryBuilder("country")
      .leftJoinAndSelect("country.regions", "region")
      .where("country.id = :id", {id: id})
      .getOne();
  }

  /**
   * Adapts input to the country entity
   * @param input 
   * @returns country entity
   */
  create(input: ICountry) {
    const country = new Country();
    country.code = input.countryCode;
    country.full_name = input.fullName;

    country.from_date_year = input.fromDate.year;
    country.from_date_month = input.fromDate.month;
    country.from_date_day = input.fromDate.day;

    country.to_date_year = input.toDate.year;
    country.to_date_month = input.toDate.month;
    country.to_date_day = input.toDate.day;


    // country.regions = regions;
    country.workdays = this.check_workday(input.holidayTypes);

    return this.countryRepository.create(country);
  }

  
  /**
   * Saves country to the database
   * @param country 
   * @returns 
   */
  async save(country: Country){
    return this.countryRepository.save(country);
  }

  
  /**
   * Saves array of countries to the database
   * 
   * (with one request)
   * @param countries 
   * @returns 
   */
  async save_array(countries: Country[]) {
    return this.countryRepository.save(countries);
  }

  /**
   * Updates country
   * 
   * updates: 
   *  - years
   *  - workdays
   *  - from dates (from which date days are available in t-p API)
   *  - to dates (to which date days are available in t-p API)
   * 
   * @param country 
   * @returns promised update result
   * @throws HttpException if country id is not provided
  */
  async update(country: ICountryEntity) {
    if (country.id == undefined) 
      throw new HttpException('Unable to update country without id', HttpStatus.INTERNAL_SERVER_ERROR);
    
    let country_years = null;
    if (country.years != null) {
      if (country.years != undefined) {
        if (country.years.length > 0) {
          country_years = country.years;
        }
      }
    }
    return this.countryRepository
    .createQueryBuilder()
    .update()
    .set({
      years: country_years,
      workdays: country.workdays,
      from_date_year: country.from_date_year,
      from_date_month: country.from_date_month,
      from_date_day: country.from_date_day,
      to_date_year: country.to_date_year,
      to_date_month: country.to_date_month,
      to_date_day: country.to_date_day
    })
    .where("id = :id", { id: country.id })
    .execute();
  }

  /**
   * Adds new days cached year
   * 
   * Query an update  
   * @param country 
   * @param year 
   */
  async add_year(country_id: number, country_years: number[] | null | undefined, year: number) {
    if (country_years == null || country_years == undefined) {
      country_years = [year];
    } else {
      country_years.push(year);
    }


    return this.countryRepository
    .createQueryBuilder()
    .update()
    .set({
      years: country_years,
    })
    .where("id = :id", { id: country_id })
    .execute();
  }


  /**
   * Saves all countries with regions to the database from API, 
   * if there were no countries previously.
   * 
   * @param response_countries
   * @returns saved countries and saved regions response
   * 
   * **(@returns will not have country region relations due to jointables)**
   */
  async saveAllNew(response_countries: ICountry[]) {
    let regions = [];
    let countries: Country[] = [];

    for (let i=0; i<response_countries.length; i++) {
        if (response_countries[i].regions.length != 0) {
            for (let j=0; j<response_countries[i].regions.length; j++) {
                regions.push({
                    "country_code": response_countries[i].countryCode,
                    "region_code": response_countries[i].regions[j]
                });
            }
        }
        countries.push(this.create(response_countries[i]));
    }
    let regionsToSave = [];
    let total = regions.length;
    let ticker = 0;
    return this.save_array(countries).then(async savedCountries => {

      for (let i=0; i<savedCountries.length; i++) {

            for (let j=0; j<regions.length; j++) {
                if (savedCountries[i].code == regions[j].country_code) {
                    regionsToSave.push(
                      this.regionEntityService.create(
                        regions[j].region_code, 
                        savedCountries[i]
                        )
                      );
                    ticker += 1;
                    continue;
                }
            }
            if (ticker == total) {
                break;
            }
        }
        return this.regionEntityService.save_array(regionsToSave)
          .then(savedRegions => {
            return {savedCountries, savedRegions}
          });
    });
  }

  /**
   * Tries to update countries and regions if found different
   * 
   * @param db_countries database countries 
   * @param response_countries response countries
   */
  async tryUpdateFromAPI(db_countries: Country[], response_countries: ICountry[]) {
    let to_save = [];
    for (let i = 0; i<response_countries.length; i++) {
      let country_found = false;
      for (let j = 0; j<db_countries.length; j++) {
          if (db_countries[j].code == response_countries[i].countryCode) {
              country_found = true;

              let workdays = false;
              for (let k=0; k < response_countries[i].holidayTypes.length; k++) {
                  if (response_countries[i].holidayTypes[k] == 'extra_working_day') {
                      workdays = true;
                      break;
                  }
              }

              // Add new regions
              // regions that are in the database, but not in the response from the API are kept
              let newRegions = [];
              for (let k=0; k<response_countries[i].regions.length; k++) {
                  // if region is not found it is send to create
                  let regionNotFound = true;
                  for (let p=0; p<response_countries[i].regions.length; p++) {
                      if (response_countries[i].regions[p] == db_countries[j].regions[k].code) {
                          regionNotFound = false;
                      }
                  }
                  if (regionNotFound) {
                      newRegions.push(
                        this.regionEntityService.create(
                          response_countries[i].regions[k], 
                          db_countries[j]
                        ));                                        
                  }
              }

              // TODO
              // if some regions are missing from the response, it is required to check which.
              // after checking delete all occurencies of removed regions in days.
              // remove in: workday_in_regions, holiday_in_regions and none_in_regions

              // TODO
              // if from_date or to_date is different will require to check days for this country.
              // there might be days that fall out of new date limit days (older or newer)
              // while it may sound absurd to remove days that are no longer available from the API,
              // it might be used as a sync method, removing less required days

              // TODO
              // if workdays are updated to false from true
              // find all days with that country or region it contains
              // remove region_id or country_id from
              // workday_in_countries, workday_in_regions

              // check if country data is different. if it is update it.
              if (db_countries[j].from_date_day != response_countries[i].fromDate.day
                  || db_countries[j].from_date_month != response_countries[i].fromDate.month
                  || db_countries[j].from_date_year != response_countries[i].fromDate.year
                  || db_countries[j].to_date_day != response_countries[i].toDate.day
                  || db_countries[j].to_date_month != response_countries[i].toDate.month
                  || db_countries[j].to_date_year != response_countries[i].toDate.year
                  || db_countries[j].workdays != workdays
                  ) {
                      db_countries[j].from_date_day = response_countries[i].fromDate.day;
                      db_countries[j].from_date_month = response_countries[i].fromDate.month;
                      db_countries[j].from_date_year = response_countries[i].fromDate.year;
                      db_countries[j].to_date_day = response_countries[i].toDate.day;
                      db_countries[j].to_date_month = response_countries[i].toDate.month;
                      db_countries[j].to_date_year != response_countries[i].toDate.year;
                      db_countries[j].workdays != workdays;

                      await this.update(db_countries[j]);
              }

              if (newRegions.length != 0) {
                  await this.regionEntityService.save_array(newRegions);
              } 
          }
      }
      if (!country_found) {
        // Country not found - create new one.
        to_save.push(this.create(response_countries[i]));
      }
    }
    for (let i=0; i<to_save.length; i++) {
      await this.save_array(to_save);
    }
  }

  /**
   * Do holiday_types contain 'extra working day'?
   * @param holiday_types 
   * @returns answer
   */
  private check_workday(holiday_types: string[]) {
    let types_length = holiday_types.length;
    let workdays = false;
    for (let i=0; i < types_length; i++) {
      if (holiday_types[i] == 'extra_working_day') {
        workdays = true
      }
    }
    return workdays;
  }
}

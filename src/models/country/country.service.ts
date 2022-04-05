import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Country } from './country.entity';
import { ICountry } from '../../integrations/holiday_callendar_api/callendar.interface';
import { ICountryEntity, ICountryEntityWithRegions } from './country.interface'
import { Region } from '../region/region.entity';
import { find } from 'rxjs';
import { IHolidaysRequestError } from 'src/resources/holidays/holidays.interface';
import { ErrorService as es } from "src/errors/adderror.service";
import { RegionEntityService } from '../region/region.service';

@Injectable()
export class CountryEntityService {
  constructor(
    @Inject('COUNTRY_REPOSITORY')
    private countryRepository: Repository<Country>,
    // @Inject('REGION_REPOSITORY')
    // private regionRepository: Repository<RegionEntity>
    private readonly regionEntityService: RegionEntityService

  ) {}

  async findAll() {
    return this.countryRepository.find();
  }

  async findAllWithRegions() {
    return this.countryRepository.find({relations: ["regions"]});
  }

  async findByCodeWithRegions(country_code: string) {
    // return this.countryRepository.findOne({
    //   relations: ["regions"],
    //   where: {
    //     code: country_code.toLowerCase()
    //   }
    // });

    let lower = country_code.toLowerCase();
    return this.countryRepository
      .createQueryBuilder("country")
      .leftJoinAndSelect("country.regions", "region")
      .where("country.code = :code", {code: lower})
      .getOne();
  }

  async findByNameWithRegions(country_name: string) {
    let lower = country_name.toLowerCase();
    return this.countryRepository
      .createQueryBuilder("country")
      .leftJoinAndSelect("country.regions", "region")
      .where("LOWER(country.full_name) = :name", {name: lower})
      .getOne();
  }

  /**
   * Finds country by given params, additionally returns requested region id
   * guaranteeing that region code is contained for that country
   * @param country_name 
   * @param country_code 
   * @param region_code 
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

  async findByFullName(full_name: string) {
    return this.countryRepository.findOne({
      where: {
        full_name: full_name
      }
    });
  }

  async findByCode(code: string) {
    return this.countryRepository.findOne({
      where: {
        code: code
      }
    });
  }

  async findByIdWithRegions(id: number) {
    return this.countryRepository
      .createQueryBuilder("country")
      .leftJoinAndSelect("country.regions", "region")
      .where("country.id = :id", {id: id})
      .getOne();
  }

  // will accept any input (in case some values will be added to API)
  // should be accepted with interface
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

  

  async save(country: Country){
    return this.countryRepository.save(country);
  }

  // async save_promise(country: Promise<Country>) {
  //   return this.save(await country);
  // }

  async save_array(countries: Country[]) {
    return this.countryRepository.save(countries);
  }

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
   * @returns UpdateResult of the query
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

    // return await this.update(country);
  }


  /**
   * saves all countries with regions to the database from API, if there were no countries.
   * @param x Country array
   * @returns saved countries and saved regions 
   * (returned from saving them (country won't have relations to regions))
   */
  async saveAllNew(x: ICountry[]) {
    let regions = [];
    let countries: Country[] = [];

    for (let i=0; i<x.length; i++) {
        if (x[i].regions.length != 0) {
            for (let j=0; j<x[i].regions.length; j++) {
                regions.push({
                    "country_code": x[i].countryCode,
                    "region_code": x[i].regions[j]
                });
            }
        }
        countries.push(this.create(x[i]));
    }
    let regionsToSave = [];
    let total = regions.length;
    let ticker = 0;
    return this.save_array(countries).then(async savedCountries => {

      for (let i=0; i<savedCountries.length; i++) {

            for (let j=0; j<regions.length; j++) {
                if (savedCountries[i].code == regions[j].country_code) {
                    regionsToSave.push(this.regionEntityService.create(regions[j].region_code, savedCountries[i]));
                    ticker += 1;
                    continue;
                }
            }
            if (ticker == total) {
                break;
            }
        }
        return this.regionEntityService.save_array(regionsToSave).then(savedRegions => {
          return {savedCountries, savedRegions}
        });
    });
  }

  async tryUpdateFromAPI(x:Country[], call_list: ICountry[]) {
    let to_save = [];
    for (let i = 0; i<call_list.length; i++) {
      let country_found = false;
      for (let j = 0; j<x.length; j++) {
          if (x[j].code == call_list[i].countryCode) {
              country_found = true;

              let workdays = false;
              for (let k=0; k < call_list[i].holidayTypes.length; k++) {
                  if (call_list[i].holidayTypes[k] == 'extra_working_day') {
                      workdays = true;
                  }
              }

              // Add new regions
              // regions that are in the database, but not in the response from the API are kept
              let newRegions = [];
              for (let k=0; k<call_list[i].regions.length; k++) {
                  let regionNotFound = true;
                  for (let p=0; p<call_list[i].regions.length; p++) {
                      if (call_list[i].regions[p] == x[j].regions[k].code) {
                          regionNotFound = false;
                      }
                  }
                  if (regionNotFound) {
                      newRegions.push(this.regionEntityService.create(call_list[i].regions[k], x[j]));                                        
                  }
              }

              // TODO
              // if some regions are missing from the response, it is required to check which
              // after checking delete all occurencies of removed regions in days 
              // keys: workday_in_regions, holiday_in_regions and none_in_regions

              // TODO
              // if from_date is different will require to check days for this country to see if there's any change.
              // check for missing days from the API or added ones.

              // TODO
              // if workdays are updated to false from true
              // find all days with that country or region it contains
              // remove region_id or country_id from
              // workday_in_countries, workday_in_regions

              // check if country data is different. if it is update it.
              if (x[j].from_date_day != call_list[i].fromDate.day
                  || x[j].from_date_month != call_list[i].fromDate.month
                  || x[j].from_date_year != call_list[i].fromDate.year
                  || x[j].to_date_day != call_list[i].toDate.day
                  || x[j].to_date_month != call_list[i].toDate.month
                  || x[j].to_date_year != call_list[i].toDate.year
                  || x[j].workdays != workdays
                  ) {
                      x[j].from_date_day = call_list[i].fromDate.day;
                      x[j].from_date_month = call_list[i].fromDate.month;
                      x[j].from_date_year = call_list[i].fromDate.year;
                      x[j].to_date_day = call_list[i].toDate.day;
                      x[j].to_date_month = call_list[i].toDate.month;
                      x[j].to_date_year != call_list[i].toDate.year;
                      x[j].workdays != workdays;

                      await this.update(x[j]);
                      // console.log("updated!");
              }

              if (newRegions.length != 0) {
                  await this.regionEntityService.save_array(newRegions);
              } 
          }
      }
      if (!country_found) {
        // Country not found - create new one.
        to_save.push(this.create(call_list[i]));
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

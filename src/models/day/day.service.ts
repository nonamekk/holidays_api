import { Injectable, Inject, HttpException, HttpStatus} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Country } from '../country/country.entity';
import { Region } from '../region/region.entity';
import { Day } from './day.entity';
import { IDayEntity } from './day.interface';
import { IDate, IDay } from '../../integrations/holiday_callendar_api/callendar.interface';
import { DescriptorService } from 'src/utilities/descriptor.service';
import { IDayStatusDate } from 'src/resources/status/status.interface';
import { CountryEntityService } from '../country/country.service';
import { RegionEntityService } from '../region/region.service';


@Injectable()
export class DayEntityService {
  constructor(
    @Inject('DAY_REPOSITORY')
    private dayRepository: Repository<Day>,
    private readonly cachedD: DescriptorService,
    private readonly countryEntityService: CountryEntityService,
    private readonly regionEntityService: RegionEntityService
  ) {}



  // prepareDayEntityList(days: DayEntity[], country_id: number, region_id?: number, workdays: boolean=false) {
  async prepareHolidaysFromDatabaseToResponse(days: Day[], country_id: number, region_id?: number) {
    return this.cachedD.getMonthsObjectArray().then(
      mo => {
        for (let i=0; i<days.length; i++) {
          let day_is_found = false;
          if (days[i].holiday_in_countries_ids != null) {
            for (let k=0; k<days[i].holiday_in_countries_ids.length; k++) {
              if (days[i].holiday_in_countries_ids[k] == country_id) {

                // here found that day is a holiday in requested country
                let day_of_week = new Date(days[i].year, days[i].month-1, days[i].day).getDay() + 1;
                mo[(days[i].month-1)].days.push({
                  "year": days[i].year,
                  "month": days[i].month,
                  "day": days[i].day,
                  "dayOfWeek": day_of_week
                })
                day_is_found = true;
                break;
              }
            }
          }
          if (!day_is_found) {
            if (days[i].holiday_in_regions_ids != null) {
              for (let k=0; k<days[i].holiday_in_regions_ids.length; k++) {
                if (days[i].holiday_in_regions_ids[k] == country_id) {
  
                  // here found that day is a holiday in requested country
                  let day_of_week = new Date(days[i].year, days[i].month-1, days[i].day).getDay() + 1;
                  mo[(days[i].month-1)].days.push({
                    "year": days[i].year,
                    "month": days[i].month,
                    "day": days[i].day,
                    "dayOfWeek": day_of_week
                  })
                  day_is_found = true;
                  break;
                }
              }
            }
            
          }
        }
         // finally sort days in each month.
         for (let i = 0; i< mo.length; i++) {
          mo[i].days.sort((a,b) => {return (+a.day) - (+b.day)});
        }
        return mo;
       
      }
    )
  }

  async prepareHolidaysFromCallendarToResponse(days: IDay[]) {
    // use cached object
    return this.cachedD.getMonthsObjectArray().then(
      mo => {
        for (let i=0; i<mo.length; i++) {
          let days_to_skip = [];
          for (let j=0; j<days.length; j++) {
            let month = days[j].date.month-1
            if (month == mo[i].id) {
              // if (days[j].holidayType) // no need to check because response returns only holidays
              let skip = false;
              for (let p=0; p<days_to_skip.length; p++) {
                if (days_to_skip[p] == days[j].date.day) {
                  skip = true;
                  break;
                }
              }
              if (!skip) {
                mo[i].days.push({
                  "year": days[j].date.year,
                  "month": days[j].date.month,
                  "day": days[j].date.day,
                  "dayOfWeek": days[j].date.dayOfWeek
                })
              }
              
            } else {
              continue;
            }
          }
        }
        return mo;
      }
    )
  }



  find_by_date(year: number, month: number, day: number) {
    return this.dayRepository.findOne({
        where: {
            year: year,
            month: month,
            day: day
        }
    });
  }

  findByYear(year: number) {
    return this.dayRepository.find({
      where: {
        year: year
      },
      order: {
        "month": 'ASC'
      }
    })
  }


  findByYearWithArrays(year: number) {
    return this.dayRepository.createQueryBuilder('day')

    // removed join many to many and replaced with an array of ids with no relations.

      // .leftJoinAndSelect("day.holiday_in_countries", "country1")
      // // .leftJoinAndSelect("day.workday_in_countries", "country")
      // .leftJoinAndSelect("day.holiday_in_regions", "region1")
      // .leftJoinAndSelect("day.workday_in_countries", "country2")
      
      // .leftJoinAndSelect("day.workday_in_regions", "region2")
      // .leftJoinAndSelect("day.none_in_countries", "country3")
      // .leftJoinAndSelect("day.none_in_regions", "region3")
      .where("day.year = :year", {year: year})
      .getMany();
  }

  create(d: IDayEntity) {
    let date = new Day();
    if (d.year != undefined && d.month != undefined && d.day != undefined) {
        date.day = d.day;
        date.month = d.month;
        date.year = d.year;
        date.absolute = d.absolute;
        date.holiday_in_countries_ids = d.holiday_in_countries_ids;
        date.holiday_in_regions_ids = d.holiday_in_regions_ids;
        date.workday_in_countries_ids = d.workday_in_countries_ids;
        date.workday_in_regions_ids = d.workday_in_regions_ids;
        date.none_in_countries_ids = d.none_in_countries_ids;
        date.none_in_regions_ids = d.none_in_regions_ids;
        return this.dayRepository.create(date);
    } else {
        throw new HttpException('Unable to create day, no day/month/year set', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    
  }

  create_array(ds: IDay[], country: Country, region?: Region) {
    let days: Day[] = [];
    for (let i=0; i<ds.length; i++) {
      let date: IDayEntity = {
        "day": 0
      };
      date.day = ds[i].date.day;
      date.month = ds[i].date.month;
      date.year = ds[i].date.year;
      if (region != undefined) {
        if (ds[i].holidayType == 'public_holiday') {
          date.holiday_in_regions_ids = [region.id]
        } else if (ds[i].holidayType = 'extra_working_day') {
          date.workday_in_regions_ids = [region.id]
        }
      } else {
        if (ds[i].holidayType == 'public_holiday') {
          date.holiday_in_countries_ids = [country.id]
        } else if (ds[i].holidayType = 'extra_working_day') {
          date.workday_in_countries_ids = [country.id]
        }
      }
      days.push(this.dayRepository.create(date));
    }
    return days;
  }

  async replace_regions_to_country_id(country_entity: Country, days: Day[]) {
    let executions: Promise<void>[] = [];

    for (let i=0; i<days.length; i++) {
      let new_list = [];

      // if holiday region ids array contain is not null
      if (days[i].holiday_in_regions_ids != null) {
        if (days[i].holiday_in_regions_ids.length != 0) {

          let to_skip = false;
          for (let j=0; j<days[i].holiday_in_regions_ids.length; j++) {
            // in this day check each in holiday_in_regions_ids

            for (let p=0; p<country_entity.regions.length; p++) {
              // need to create new list where there will be no regions that are of country

              if (days[i].holiday_in_regions_ids[j] == country_entity.regions[p].id) {
                // skip this insert
                to_skip = true;
              }
            }
            if (!to_skip) {
              new_list.push(days[i].holiday_in_regions_ids[j])
            } else {
              continue;
            }
          }

          days[i].holiday_in_regions_ids = new_list;
        } else if 
          (days[i].workday_in_regions_ids != null) if
          (days[i].workday_in_regions_ids.length != 0) {

            let to_skip = false;
            for (let j=0; j<days[i].workday_in_regions_ids.length; j++) {
              // in this day check each in holiday_in_regions_ids
  
              for (let p=0; p<country_entity.regions.length; p++) {
                // need to create new list where there will be no regions that are of country
  
                if (days[i].workday_in_regions_ids[j] == country_entity.regions[p].id) {
                  // skip this insert
                  to_skip = true;
                }
              }
              if (!to_skip) {
                new_list.push(days[i].workday_in_regions_ids[j])
              } else {
                continue;
              }
            }

            days[i].holiday_in_regions_ids = new_list;
          }
      }

      if (days[i].holiday_in_countries_ids == null) {
        days[i].holiday_in_countries_ids = [country_entity.id];
      } else {
        days[i].holiday_in_countries_ids.push(country_entity.id);
      }


      executions.push(this.update(days[i]))
    }


    for (let i =0; i<executions.length; i++) {
      await executions[i]
    }
  }

  save(d: Day) {
    return this.dayRepository.save(d);
  }

  saveArray(ds: Day[]) {
      return this.dayRepository.save(ds);
  }

  // todo add datetime when was the last update/create
  async update(d: IDayEntity) {

    if (d.holiday_in_countries_ids != undefined) {
      if (d.holiday_in_countries_ids.length == 0) 
        d.holiday_in_countries_ids = null;
    }

    if (d.holiday_in_regions_ids != undefined) {
      if (d.holiday_in_regions_ids.length == 0) 
        d.holiday_in_regions_ids = null;
    }

    if (d.workday_in_countries_ids != undefined) {
      if (d.workday_in_countries_ids.length == 0) 
        d.workday_in_countries_ids = null;
    }

    if (d.workday_in_regions_ids != undefined) {
      if (d.workday_in_regions_ids.length == 0) 
        d.workday_in_regions_ids = null;
    }

    if (d.none_in_countries_ids != undefined) {
      if (d.none_in_countries_ids.length == 0) 
        d.none_in_countries_ids = null;
    }

    if (d.none_in_regions_ids != undefined) {
      if (d.none_in_regions_ids.length == 0) 
        d.none_in_regions_ids = null;
    }

    let query = this.dayRepository
      .createQueryBuilder()
      .update()
      .set({
        absolute: d.absolute,
        holiday_in_countries_ids: d.holiday_in_countries_ids,
        holiday_in_regions_ids: d.holiday_in_regions_ids,
        workday_in_countries_ids: d.workday_in_countries_ids,
        workday_in_regions_ids: d.workday_in_regions_ids,
        none_in_countries_ids: d.none_in_countries_ids,
        none_in_regions_ids: d.none_in_regions_ids
      });
      

    if (d.id != undefined) {
        query.where("id = :id", {id: d.id});
      } else
        if (d.year != undefined && d.month != undefined && d.day != undefined) {
        query.where("year = :year AND month = :month AND day = :day", { 
            year: d.year,
            month: d.month,
            day: d.year 
        });
      } else {
        throw new HttpException("Can only update day if id or [day, month and year] (full date) are provided", HttpStatus.INTERNAL_SERVER_ERROR);
      }

    query.execute();
  }

  async updateDifferent(days_response: IDay[], days_database: Day[], country_entity: Country, region_entity?: Region) {
    let executions: Promise<void>[] = [];
    let creations = [];

    for (let i=0; i<days_response.length; i++) {
      // console.log(days_response);

      for (let j=0; j<days_database.length; j++) {
        if (days_response[i].date.year == days_database[j].year
          && days_response[i].date.month == days_database[j].month
          && days_response[i].date.year == days_database[j].year
        ) {
          // day is found here
          // check if array contain years, countries and regions, check if absolute

          if (region_entity != undefined) {
            // in this case prioritize region to update entity
            if (days_response[i].holidayType == 'public_holiday') {
              let region_is_in_array = false;
              // console.log(days_database[j]);
              if (days_database[j].holiday_in_regions_ids != null)
              for (let p=0; p<days_database[j].holiday_in_regions_ids.length; p++) {
                if (days_database[j].holiday_in_regions_ids[p] == region_entity.id) {
                  region_is_in_array = true;
                  break;
                }
              }
              if (!region_is_in_array) {
                if (days_database[j].holiday_in_regions_ids == null) {
                  days_database[j].holiday_in_regions_ids = [region_entity.id]
                } else {
                  days_database[j].holiday_in_regions_ids.push(region_entity.id);
                }
                
              }
            } else if (days_response[i].holidayType == 'extra_working_day') {
              let region_is_in_array = false;
              if (days_database[j].workday_in_regions_ids != null)
              for (let p=0; p<days_database[j].workday_in_regions_ids.length; p++) {
                if (days_database[j].workday_in_regions_ids[p] == region_entity.id) {
                  region_is_in_array = true;
                }
              }
              if (!region_is_in_array) {
                if (days_database[j].workday_in_regions_ids == null) {
                  days_database[j].workday_in_regions_ids = [region_entity.id]
                } else {
                  days_database[j].workday_in_regions_ids.push(region_entity.id);
                }
              }
            }

            // check to see if all regions have saved to workday_in or holiday_in
            // if all regions are saved, empty list and save country_id to workday or holiday

            let total_number_of_regions = country_entity.regions.length;
            if (days_database[j].holiday_in_regions_ids != null)
            if (days_database[j].holiday_in_regions_ids.length == total_number_of_regions) {
              let counter = total_number_of_regions;
              for (let p=0; p<days_database[j].holiday_in_regions_ids.length; p++) {
                for (let z=0; z<country_entity.regions.length; z++) {
                  if (country_entity.regions[z].id == days_database[j].holiday_in_regions_ids[j]) {
                    counter -= 1;
                    console.log(counter);
                  }
                }
              }
              console.log("final counter: " + counter)
              if (counter == 0) {
                days_database[j].holiday_in_regions_ids = [];
                if (days_database[j].holiday_in_countries_ids != null) {
                  days_database[j].holiday_in_countries_ids = [country_entity.id]
                } else {
                  days_database[j].holiday_in_countries_ids.push(country_entity.id);
                }
              }
            }

          } else {
            if (days_response[i].holidayType == 'public_holiday') {
              let counry_is_in_array = false;
              if (days_database[j].holiday_in_countries_ids != null)
              for (let p=0; p<days_database[j].holiday_in_countries_ids.length; p++) {
                if (days_database[j].holiday_in_countries_ids[p] == country_entity.id) {
                  counry_is_in_array = true;
                }
              }
              if (!counry_is_in_array) {
                if (days_database[j].holiday_in_countries_ids != null) {
                  days_database[j].holiday_in_countries_ids.push(country_entity.id);
                } else {
                  days_database[j].holiday_in_countries_ids = [country_entity.id];
                }
                
              }
            } else if (days_response[i].holidayType == 'extra_working_day') {
              let country_is_in_array = false;
              if (days_database[j].workday_in_countries_ids != null)
              for (let p=0; p<days_database[j].workday_in_countries_ids.length; p++) {
                if (days_database[j].workday_in_countries_ids[p] == country_entity.id) {
                  country_is_in_array = true;
                }
              }
              if (!country_is_in_array) {
                if (days_database[j].workday_in_countries_ids != null) {
                  days_database[j].workday_in_countries_ids.push(country_entity.id);
                } else {
                  days_database[j].workday_in_countries_ids = [country_entity.id];
                }
              }
            }
          }
          executions.push(this.update(days_database[j]));
          /////////////////////////////
          break;
        } else {
          if (j == days_database.length-1) {
            // console.log(j);
            // console.log("must be equal to "+ (days_database.length-1))
            // check if it the last step
            let day = new Day();
            day.day = days_response[i].date.day;
            day.month = days_response[i].date.month;
            day.year = days_response[i].date.year;

            if (region_entity != undefined) {
              if (days_response[i].holidayType == 'public_holiday') {
                day.holiday_in_regions_ids = [region_entity.id];
              } else if (days_response[i].holidayType = 'extra_working_day') {
                day.workday_in_regions_ids = [region_entity.id];
              
            } else {
              if (days_response[i].holidayType == 'public_holiday') {
                day.holiday_in_countries_ids = [country_entity.id];
              } else if (days_response[i].holidayType = 'extra_working_day') {
                day.workday_in_countries_ids = [country_entity.id]
              }
            }
            creations.push(this.create(day));
            }

          }
        }
      }
    }
    for (let i=0; i< executions.length; i++) {
      await executions[i]
    }

    if (creations.length > 0) {
      await this.saveArray(creations)
    }
  }

  createDayFromResponse(day_response: IDay[], day_requested: IDayStatusDate, country_id: number, region_id?: number) {
    return this.createOneDayFromResponse(
      this.extractDayFromResponse(day_response), day_requested, country_id, region_id);
  }

  updateDayFromResponse(day_response: IDay[], day_database: Day, country_entity: Country, region_id?: number) {
    return this.updateOneDayFromResponse(
      this.extractDayFromResponse(day_response), day_database, country_entity, region_id);
  }

  extractDayFromResponse(day_response: IDay[]) {
    for (let i=0; i<day_response.length; i++) {
      if (day_response[i].holidayType == 'public_holiday' || day_response[i].holidayType == 'extra_working_day') {
        return day_response[i]
      }
    }
    return null;
  }

  /**
   * Saves the new day to the database
   * (there's no check whether or not this is the 365th or 366th day of checked country/region to identify all year is cached) 
   * @param day_response 
   * @param day_requested 
   * @param country_id 
   * @param region_id 
   * @returns saved day
   */
  createOneDayFromResponse(day_response: IDay, day_requested: IDayStatusDate, country_id: number, region_id?: number) {
    let new_day: IDayEntity;
    if (day_response == null) {
      new_day.day = day_requested.day;
      new_day.month = day_requested.month;
      new_day.year = day_requested.year;

      if (region_id != undefined) {
        new_day.none_in_regions_ids = [region_id]
      } else {
        new_day.none_in_countries_ids = [country_id]
      }

    } else {
      new_day.day = day_response.date.day;
      new_day.month = day_response.date.month;
      new_day.year = day_response.date.year;

      if (day_response.holidayType == 'public_holiday') {
        if (region_id != undefined) {
          new_day.holiday_in_regions_ids = [region_id];
        } else {
          new_day.holiday_in_countries_ids = [country_id];
        }
      } else {
        if (region_id != undefined) {
          new_day.workday_in_regions_ids = [region_id];
        } else {
          new_day.workday_in_countries_ids = [country_id]
        }
      }
    }
    

    
    return this.save(this.create(new_day));
    // TODO add check to see if it is last day for country/region set, to anounce this day's year is completely cached.
  }

  /**
   * Updates already existing day in db from obtained in response.
   * 
   * Checks if all regions are contained under one list, if it is remove all region_ids 
   * from list and add country_id to list from same group (from holiday_in_regions to 
   * holiday_in_countries)
   * 
   * Checks if it is the last day of country/region day set (365th or 366th day of year).
   * If it is update country or region cached years, remove ids from none_in... list groups
   * 
   * Check if the day is absolute or if day was checked by all countries and regions individually. 
   * Removes all ids from none_in.. list groups if found that it is absolute.
   * 
   * @param day_response 
   * @param day_database 
   * @param country_entity 
   * @param region_id 
   */
  async updateOneDayFromResponse(day_response: IDay, day_database: Day, country_entity: Country, region_id?: number) {
    let region_added = false;
    let country_added = false;
    if (day_response == null) {
      // update to none_in...
      if (region_id != undefined) {
        if (day_database.none_in_regions_ids == null) {
          day_database.none_in_regions_ids = [region_id];
        } else {
          day_database.none_in_regions_ids.push(region_id)
        }
        region_added = true;
      } else {
        if (day_database.none_in_countries_ids == null) {
          day_database.none_in_countries_ids = [country_entity.id];
        } else {
          day_database.none_in_countries_ids.push(country_entity.id);
        }
        country_added = true;
      }
    } else {
      if (day_response.holidayType == 'public_holiday') {
        if (region_id != undefined) {
          if (day_database.holiday_in_regions_ids == null) {
            day_database.holiday_in_regions_ids = [region_id];
          } else {
            day_database.holiday_in_regions_ids.push(region_id)
          }
          region_added = true;
        } else {
          if (day_database.holiday_in_countries_ids == null) {
            day_database.holiday_in_countries_ids = [country_entity.id];
          } else {
            day_database.holiday_in_countries_ids.push(country_entity.id);
          }
          country_added = true;
        }
      } else {
        if (region_id != undefined) {
          if (day_database.workday_in_regions_ids == null) {
            day_database.workday_in_regions_ids = [region_id];
          } else {
            day_database.workday_in_regions_ids.push(region_id)
          }
          region_added;
        } else {
          if (day_database.workday_in_countries_ids == null) {
            day_database.workday_in_countries_ids = [country_entity.id];
          } else {
            day_database.workday_in_countries_ids.push(country_entity.id);
          }
          country_added;
        }
      }
    }

    // now check if regions are totalled in day (if all regions from country are contained in day)
    // under any result save day to database, will require it later when checking all days (to see if need to update cached year for country/region)
    if (region_added) {
      await this.update(this.trySwitchRegionIdToCountryId(country_entity, day_database));
    } else {
      if (country_added) {
       await this.update(this.tryRemoveRegions(day_database, country_entity))
      } else {
        await this.update(day_database);
      }
    }
    
    
    // after this need to check day for - each id from either country_id or region_id.
    // that is to make value absolute, which states, that this day was checked by every country and region, therefore removing ids from none_in.. array

    // if for example currently observed day is 365th of 365 days year, need to update either country or region cached year.
    // if country or region cached year gets modified, then remove country_id or region_id from none_in...
    let all_days = await this.findByYear(day_database.year);
    if (region_id != undefined) {
      // same thing for regions
      await this.tryUpdateRegionCachedYear(country_entity, region_id, all_days, day_database.year);
    } else {
        await this.tryUpdateCountryCachedYear(country_entity, all_days, day_database.year);
    }

    // dont forget to check if day absolute
    if(await this.isDayEligableToBeAbsolute(day_database)) {
      await this.makeDayAbsolute(day_database.id);
    }


  }

  async tryUpdateCountryCachedYear(country_entity: Country, all_days: Day[], year: number) {
    if (this.doesCountryRequireUpdateOfYear(country_entity, all_days, year)) {
      // country has all days cached for specified year.
      await this.countryEntityService.add_year(country_entity, year);
      await this.removeCountryFromNoneIn(country_entity, all_days);
    }
  }

  async tryUpdateRegionCachedYear(country_entity: Country, region_id: number, all_days: Day[], year: number) {
    if (this.doesRegionRequireUpdateOfYear(country_entity, region_id, all_days, year)) {
      let region_entity: Region = undefined;
      for (let i=0; i<country_entity.regions.length; i++) {
        if (country_entity.regions[i].id == region_id) {
          region_entity = country_entity.regions[i];
        }
      }
      if (region_entity == undefined) {
        throw "Can't find region_entity in country_entity, although region_id was provided (?)";
      }
      await this.regionEntityService.add_year(region_entity, year, country_entity);
      // if country updates the year, then should we remove all none_in.. for all regions and not just one.
      // check by the country updated and region, so need to find country from the database
      await this.removeRegionFromNoneIn(country_entity.id, region_entity, all_days);
    }
  }

  trySwitchRegionIdToCountryId(country_entity: Country, day_database: Day) {
    
    if (country_entity.regions.length == 0) return day_database;

    

    let regions_ids_check_list: number[] = [];
    for (let i=0; i<country_entity.regions.length; i++) {
      regions_ids_check_list.push(country_entity.regions[i].id);
    }

    // this identifies if transition from every region_id from country was made
    let transition_made = false;

    // this list will add regions that are not part of the county_entity under scope
    let new_some_in_list: number[] = [];
    // this list will populate if delete ever occured, but only used if all regions of country are present under one list (holiday_in_regions_ids)

    if (day_database.holiday_in_regions_ids != null) {
      if (day_database.holiday_in_regions_ids.length >= country_entity.regions.length) {

        // checks if delete ever happened
        let delete_happened = false;
        for (let i=0; day_database.holiday_in_regions_ids.length; i++) {
          // checks if delete occured under in the scope of this day
          let delete_occured = false;
          for (let j=0; j<regions_ids_check_list.length; j++) {
            if (regions_ids_check_list[j] != undefined) {

              if (regions_ids_check_list[j] == day_database.holiday_in_regions_ids[i]) {
                delete_occured = true;
                delete regions_ids_check_list[i];
                if (!delete_happened) {
                  delete_happened = true;
                }
              }
            }
          }
          if (!delete_occured) {
            new_some_in_list.push(day_database.holiday_in_regions_ids[i]);
          }
        }
        if (delete_happened) {
          regions_ids_check_list.filter(v => {
            return v != undefined
          });
          if (regions_ids_check_list.length == 0) {
            // all regions are present under one list
            day_database.holiday_in_regions_ids = new_some_in_list;
            if (day_database.holiday_in_countries_ids != null) {
              day_database.holiday_in_countries_ids.push(country_entity.id);
            } else {
              day_database.holiday_in_countries_ids = [country_entity.id];
            }
            transition_made = true;
          }
        }
      }
    }

    if (!transition_made) {
      // repeat the same for other lists,
      // but clean and populate lists if required
      new_some_in_list = [];
      if (country_entity.regions.length != regions_ids_check_list.length) {
        regions_ids_check_list = [];
        for (let i=0; i<country_entity.regions.length; i++) {
          regions_ids_check_list.push(country_entity.regions[i].id);
        }
      }

      // the reason for duplicating code is that methods returning the result (2 variables) can't be replaced directly to current variables
      // meaning we need to alocate more memory for storing return value and then replacing variables that we need with it (at least)
      // in any way duplication of data will take place if we want to change not exactly that list, but any list, given the input.
      // short --> can pass object by reference, can't pass array of object by reference

      if (day_database.workday_in_regions_ids != null) {
        if (day_database.workday_in_regions_ids.length >= country_entity.regions.length) {
  
          // checks if delete ever happened
          let delete_happened = false;
          for (let i=0; day_database.workday_in_regions_ids.length; i++) {
            // checks if delete occured under in the scope of this day
            let delete_occured = false;
            for (let j=0; j<regions_ids_check_list.length; j++) {
              if (regions_ids_check_list[j] != undefined) {
  
                if (regions_ids_check_list[j] == day_database.workday_in_regions_ids[i]) {
                  delete_occured = true;
                  delete regions_ids_check_list[i];
                  if (!delete_happened) {
                    delete_happened = true;
                  }
                }
              }
            }
            if (!delete_occured) {
              new_some_in_list.push(day_database.workday_in_regions_ids[i]);
            }
          }
          if (delete_happened) {
            regions_ids_check_list.filter(v => {
              return v != undefined
            });
            if (regions_ids_check_list.length == 0) {
              // all regions are present under one list
              day_database.workday_in_regions_ids = new_some_in_list;
              if (day_database.workday_in_countries_ids != null) {
                day_database.workday_in_countries_ids.push(country_entity.id);
              } else {
                day_database.workday_in_countries_ids = [country_entity.id];
              }
              transition_made = true;
            }
          }
        }
      }

      if (!transition_made) {
        // but clean and populate lists if required
        new_some_in_list = [];
        if (country_entity.regions.length != regions_ids_check_list.length) {
          regions_ids_check_list = [];
          for (let i=0; i<country_entity.regions.length; i++) {
            regions_ids_check_list.push(country_entity.regions[i].id);
          }
        }

        if (day_database.none_in_regions_ids != null) {
          if (day_database.none_in_regions_ids.length >= country_entity.regions.length) {
    
            // checks if delete ever happened
            let delete_happened = false;
            for (let i=0; day_database.none_in_regions_ids.length; i++) {
              // checks if delete occured under in the scope of this day
              let delete_occured = false;
              for (let j=0; j<regions_ids_check_list.length; j++) {
                if (regions_ids_check_list[j] != undefined) {
    
                  if (regions_ids_check_list[j] == day_database.none_in_regions_ids[i]) {
                    delete_occured = true;
                    delete regions_ids_check_list[i];
                    if (!delete_happened) {
                      delete_happened = true;
                    }
                  }
                }
              }
              if (!delete_occured) {
                new_some_in_list.push(day_database.none_in_regions_ids[i]);
              }
            }
            if (delete_happened) {
              regions_ids_check_list.filter(v => {
                return v != undefined
              });
              if (regions_ids_check_list.length == 0) {
                // all regions are present under one list
                day_database.none_in_regions_ids = new_some_in_list;
                if (day_database.none_in_countries_ids != null) {
                  day_database.none_in_countries_ids.push(country_entity.id);
                } else {
                  day_database.none_in_countries_ids = [country_entity.id];
                }
                transition_made = true;
              }
            }
          }
        }

      }
    }

    return day_database;

  }

  tryRemoveRegions(day_database: Day, country_entity: Country) {
    // check if any countries list has the country_id to remove all regions of that country from the same list
    if (country_entity.regions.length == 0) {
      return day_database;
    }

    // this list will add regions that are not part of the county_entity under scope
    let new_some_in_list: number[] = [];
    // this list will populate if delete ever occured, but only used if all regions of country are present under one list (holiday_in_regions_ids)

    // this identifies if transition from every region_id from country was made
    let clearing_made = false;

    let regions_ids_check_list: number[] = [];
    for (let i=0; i<country_entity.regions.length; i++) {
      regions_ids_check_list.push(country_entity.regions[i].id);
    }

    if (day_database.holiday_in_countries_ids != null) {

      for (let i=0; i<day_database.holiday_in_countries_ids.length; i++) {
        if (country_entity.id = day_database.holiday_in_countries_ids[i]) {
          if (day_database.holiday_in_regions_ids.length >= country_entity.regions.length) {
            
              // checks if delete ever happened
              let delete_happened = false;
              for (let i=0; day_database.holiday_in_regions_ids.length; i++) {
                // checks if delete occured under in the scope of this day
                let delete_occured = false;
                for (let j=0; j<regions_ids_check_list.length; j++) {
                  if (regions_ids_check_list[j] != undefined) {
      
                    if (regions_ids_check_list[j] == day_database.holiday_in_regions_ids[i]) {
                      delete_occured = true;
                      delete regions_ids_check_list[i];
                      if (!delete_happened) {
                        delete_happened = true;
                      }
                    }
                  }
                }
                if (!delete_occured) {
                  new_some_in_list.push(day_database.holiday_in_regions_ids[i]);
                }
              }
              if (delete_happened) {
                regions_ids_check_list.filter(v => {
                  return v != undefined
                });
                if (regions_ids_check_list.length == 0) {
                  // all regions are present under one list
                  day_database.holiday_in_regions_ids = new_some_in_list;
                  
                  clearing_made = true;
                }
              }
            
          }
        } 
      }
    }


    

    if (!clearing_made) {
      // repeat the same for other lists,
      // but clean and populate lists if required

      if (day_database.workday_in_countries_ids != null) {
        for (let i=0; i<day_database.workday_in_countries_ids.length; i++) {
          if (country_entity.id = day_database.workday_in_countries_ids[i]) {
            new_some_in_list = [];
            if (country_entity.regions.length != regions_ids_check_list.length) {
              regions_ids_check_list = [];
              for (let i=0; i<country_entity.regions.length; i++) {
                regions_ids_check_list.push(country_entity.regions[i].id);
              }
            }

            // checks if delete ever happened
            let delete_happened = false;
            for (let i=0; day_database.workday_in_regions_ids.length; i++) {
              // checks if delete occured under in the scope of this day
              let delete_occured = false;
              for (let j=0; j<regions_ids_check_list.length; j++) {
                if (regions_ids_check_list[j] != undefined) {
    
                  if (regions_ids_check_list[j] == day_database.workday_in_regions_ids[i]) {
                    delete_occured = true;
                    delete regions_ids_check_list[i];
                    if (!delete_happened) {
                      delete_happened = true;
                    }
                  }
                }
              }
              if (!delete_occured) {
                new_some_in_list.push(day_database.workday_in_regions_ids[i]);
              }
            }
            if (delete_happened) {
              regions_ids_check_list.filter(v => {
                return v != undefined
              });
              if (regions_ids_check_list.length == 0) {
                // all regions are present under one list
                day_database.workday_in_regions_ids = new_some_in_list;
                
                clearing_made = true;
              }
            }
          }
        }
         
        
      }

      if (!clearing_made) {
        if (day_database.none_in_countries_ids != null) {
          for (let i=0; i<day_database.none_in_countries_ids.length; i++) {
            if (country_entity.id = day_database.none_in_countries_ids[i]) {
              new_some_in_list = [];
              if (country_entity.regions.length != regions_ids_check_list.length) {
                regions_ids_check_list = [];
                for (let i=0; i<country_entity.regions.length; i++) {
                  regions_ids_check_list.push(country_entity.regions[i].id);
                }
              }
  
              // checks if delete ever happened
              let delete_happened = false;
              for (let i=0; day_database.none_in_regions_ids.length; i++) {
                // checks if delete occured under in the scope of this day
                let delete_occured = false;
                for (let j=0; j<regions_ids_check_list.length; j++) {
                  if (regions_ids_check_list[j] != undefined) {
      
                    if (regions_ids_check_list[j] == day_database.none_in_regions_ids[i]) {
                      delete_occured = true;
                      delete regions_ids_check_list[i];
                      if (!delete_happened) {
                        delete_happened = true;
                      }
                    }
                  }
                }
                if (!delete_occured) {
                  new_some_in_list.push(day_database.none_in_regions_ids[i]);
                }
              }
              if (delete_happened) {
                regions_ids_check_list.filter(v => {
                  return v != undefined
                });
                if (regions_ids_check_list.length == 0) {
                  // all regions are present under one list
                  day_database.none_in_regions_ids = new_some_in_list;
                  
                  clearing_made = true;
                }
              }
            }
          }
        }
      }

    }


    return day_database;
  }


  async isDayEligableToBeAbsolute(day: Day): Promise<boolean> {
    // csrs = CountrieS + RegionS
    // cr = Country + Region
    return await this.countryEntityService.findAllWithRegions().then(async csrs => {
      if (csrs.length == 0) {
        throw "Can't try value for absolute eligability if no countries are present";
      }
      // there's a chance that this day was the only day checked by all countries and their regions without requesting all days for this year.
      if (day.holiday_in_countries_ids.length + day.workday_in_countries_ids.length + day.none_in_countries_ids.length == csrs.length) {
        // day.absolute = true;
        return true;
      } else {
        let n_of_countries_without_regions = 0;
        for (let i=0; i<csrs.length; i++) {
          if (csrs[i].regions.length == 0) {
            n_of_countries_without_regions++;
          }
        }
        if (day.holiday_in_countries_ids.length + day.workday_in_countries_ids.length + day.none_in_countries_ids.length >= n_of_countries_without_regions) {
          let countries_not_found: Country[] = [];
          for (let i=0; i<csrs.length; i++) {
            let not_found = true;
            if (day.none_in_countries_ids != null) {
              for (let j=0; j<day.none_in_countries_ids.length; j++) {
                if (day.none_in_countries_ids[j] != undefined) {
                  if (day.none_in_countries_ids[j] == csrs[i].id) {
                    not_found = false;
                    delete day.none_in_countries_ids[j];
                  }
                }
              }
            }
            if (not_found) {
              if (day.holiday_in_countries_ids != null) {
                for (let j=0; j<day.holiday_in_countries_ids.length; j++) {
                  if (day.holiday_in_countries_ids[j] != undefined) {
                    if (day.holiday_in_countries_ids[j] == csrs[i].id) {
                      not_found = false;
                      delete day.holiday_in_countries_ids[j];
                    }
                  }
                }
              }
              if (not_found) {
                if (day.workday_in_countries_ids != null) {
                  for (let j=0; j<day.workday_in_countries_ids.length; j++) {
                    if (day.workday_in_countries_ids[j] != undefined) {
                      if (day.workday_in_countries_ids[j] == csrs[i].id) {
                        not_found = false;
                        delete day.workday_in_countries_ids[j];
                      }
                    }
                  }
                }
                if (not_found) {
                  countries_not_found.push(csrs[i]);
                }
              } else continue;
            } else continue;
          }

          if (countries_not_found.length == 0) {
            // day.absolute = true;
            return true;
          } else {
            
            for (let i=0; i<countries_not_found.length; i++) {
              let total_regions = countries_not_found[i].regions.length;
              let regions_counter = 0;
              let not_found = true;

              // until find every region_id of country
              if (day.none_in_regions_ids != null) {
                for (let j=0; j<day.none_in_regions_ids.length; j++) {


                  if (day.none_in_regions_ids[j] != undefined) {
                    // each region
                    for (let p=0; countries_not_found[i].regions.length; p++) {
                      if (countries_not_found[i].regions[p] !=undefined) {
                        if (countries_not_found[i].regions[p].id == day.none_in_regions_ids[j]) {
                          not_found = false;
                          delete day.none_in_regions_ids[j];
                          delete countries_not_found[i].regions[p];
                          regions_counter++;
                          break;
                        }
                      }
                      
                    }
                  }
                  if (regions_counter == total_regions) {
                    break;
                    // all regions of country were found in none_in_regions
                  }
                }
              }
              if (regions_counter == total_regions) {
                break;
                // all regions of country were found in none_in_regions
              } else {
                if (day.holiday_in_regions_ids != null) {
                  for (let j=0; j<day.holiday_in_regions_ids.length; j++) {


                    if (day.holiday_in_regions_ids[j] != undefined) {
                      // each region
                      for (let p=0; countries_not_found[i].regions.length; p++) {
                        if (countries_not_found[i].regions[p] !=undefined) {
                          if (countries_not_found[i].regions[p].id == day.holiday_in_regions_ids[j]) {
                            not_found = false;
                            delete day.holiday_in_regions_ids[j];
                            delete countries_not_found[i].regions[p];
                            regions_counter++;
                            break;
                          }
                        }
                        
                      }
                    }
                    if (regions_counter == total_regions) {
                      break;
                      // all regions of country were found in none_in_regions or holiday_in_regions
                    }
                  }
                }
                if (regions_counter == total_regions) {
                  break;
                  // all regions of country were found in none_in_regions or holiday_in_regions
                } else {
                  if (day.workday_in_regions_ids != null) {
                    for (let j=0; j<day.workday_in_regions_ids.length; j++) {
  
  
                      if (day.workday_in_regions_ids[j] != undefined) {
                        // each region
                        for (let p=0; countries_not_found[i].regions.length; p++) {
                          if (countries_not_found[i].regions[p] !=undefined) {
                            if (countries_not_found[i].regions[p].id == day.workday_in_regions_ids[j]) {
                              not_found = false;
                              delete day.workday_in_regions_ids[j];
                              delete countries_not_found[i].regions[p];
                              regions_counter++;
                              break;
                            }
                          }
                          
                        }
                      }
                      if (regions_counter == total_regions) {
                        break;
                        // all regions of country were found in none_in_regions or holiday_in_regions or workday_in_regions
                      }
                    }
                  }
                  if (regions_counter != total_regions) {
                    // day is not absolute
                    return false;
                  }
                }
              }
            }

            return true;
          }
          
        } else return false;
      }

    });
  }

  makeDayAbsolute(day_id: number) {
    return this.dayRepository
    .createQueryBuilder()
    .update()
    .set({
      none_in_countries_ids: null,
      none_in_regions_ids: null,
      absolute: true
    })
    .where("id = :id", { id: day_id })
    .execute();
  }

  private daysInYear(year: number) {
    return ((year % 4 === 0 && year % 100 > 0) || year %400 == 0) ? 366: 365;
  }

  doesCountryRequireUpdateOfYear(country_entity: Country, days: Day[], year: number) {
    if (days.length == this.daysInYear(year)) {

      for (let i=0; i<days.length; i++) {
        let day_deleted = false;
        if (days[i].holiday_in_countries_ids != null) {
          for (let j=0; j<days[i].holiday_in_countries_ids.length; j++) {
            if (days[i].holiday_in_countries_ids[j] == country_entity.id) {
              delete days[i];
              day_deleted = true;
              break;
            }
          }
        }
        if (!day_deleted) {
          if (days[i].workday_in_countries_ids != null) {
            for (let j=0; j<days[i].workday_in_countries_ids.length; j++) {
              if (days[i].workday_in_countries_ids[j] == country_entity.id) {
                delete days[i];
                day_deleted = true;
                break;
              }
            }
          }
        } else continue;
        if (!day_deleted) {
          if (days[i].none_in_countries_ids != null) {
            for (let j=0; j<days[i].none_in_countries_ids.length; j++) {
              if (days[i].none_in_countries_ids[j] == country_entity.id) {
                delete days[i];
                day_deleted = true;
                break;
              }
            }
          }
        }
      }

      let decision = true;
      for (let i=0; i<days.length; i++) {
        if (days[i] != undefined) {
          decision = false;
          break;
        }
      }
      return decision;

    } else {
      return false;
    }
  }

  async removeCountryFromNoneIn(country_entity: Country, days: Day[]) {
    // no check for amount of days because prior to this doesCountryRequireUpdateOfYear must be executed
    let updates: Promise<void>[] = [];
    for (let i=0; i<days.length; i++) {
      if (days[i].none_in_countries_ids != null) {
        for (let j=0; j<days[i].none_in_countries_ids.length; j++) {
          if (days[i].none_in_countries_ids[j] == country_entity.id) {
            delete days[i].none_in_countries_ids[i];

            days[i].none_in_countries_ids.filter(v => {
              return v != undefined
            })
          }
        }
      }
      updates.push(this.update(days[i]));
    }

    for (let i=0; i<updates.length; i++) {
      await updates[i]
    }

  }

  doesRegionRequireUpdateOfYear(country_entity: Country, region_id: number, days: Day[], year: number) {
    if (days.length == this.daysInYear(year)) {
      
      for (let i=0; i<days.length; i++) {
        let day_deleted = false;
        if (days[i].holiday_in_countries_ids != null) {
          for (let j=0; j<days[i].holiday_in_countries_ids.length; j++) {
            if (days[i].holiday_in_countries_ids[j] == country_entity.id) {
              delete days[i];
              day_deleted = true;
              break;
            }
          }
          if (!day_deleted) {
            for (let j=0; j<days[i].holiday_in_regions_ids.length; j++) {
              if (days[i].holiday_in_regions_ids[j] == region_id) {
                delete days[i];
                day_deleted = true;
                break;
              }
            }
          }
        } else {
          if (days[i].holiday_in_regions_ids != null) {
            for (let j=0; j<days[i].holiday_in_regions_ids.length; j++) {
              if (days[i].holiday_in_regions_ids[j] == region_id) {
                delete days[i];
                day_deleted = true;
                break;
              }
            }
          }
        }


        if (day_deleted) {
          continue;
        } else {
          if (days[i].workday_in_countries_ids != null) {
            for (let j=0; j<days[i].workday_in_countries_ids.length; j++) {
              if (days[i].workday_in_countries_ids[j] == country_entity.id) {
                delete days[i];
                day_deleted = true;
                break;
              }
            }
            if (!day_deleted) {
              for (let j=0; j<days[i].workday_in_regions_ids.length; j++) {
                if (days[i].workday_in_regions_ids[j] == region_id) {
                  delete days[i];
                  day_deleted = true;
                  break;
                }
              }
            }
          } else {
            if (days[i].workday_in_regions_ids != null) {
              for (let j=0; j<days[i].workday_in_regions_ids.length; j++) {
                if (days[i].workday_in_regions_ids[j] == region_id) {
                  delete days[i];
                  day_deleted = true;
                  break;
                }
              }
            }
          }
        }

        if (!day_deleted) {
          if (days[i].none_in_countries_ids != null) {
            for (let j=0; j<days[i].none_in_countries_ids.length; j++) {
              if (days[i].none_in_countries_ids[j] == country_entity.id) {
                delete days[i];
                day_deleted = true;
                break;
              }
            }
            if (!day_deleted) {
              for (let j=0; j<days[i].none_in_regions_ids.length; j++) {
                if (days[i].none_in_regions_ids[j] == region_id) {
                  delete days[i];
                  day_deleted = true;
                  break;
                }
              }
            }
          } else {
            if (days[i].none_in_regions_ids != null) {
              for (let j=0; j<days[i].none_in_regions_ids.length; j++) {
                if (days[i].none_in_regions_ids[j] == region_id) {
                  delete days[i];
                  day_deleted = true;
                  break;
                }
              }
            }
          }
        }

        let decision = true;
        for (let i=0; i<days.length; i++) {
          if (days[i] != undefined) {
            decision = false;
            break;
          }
        }
        return decision;

      }
    } else {
      return false;
    }
  }

  async removeRegionFromNoneIn(country_id: number, region_entity: Region, days: Day[]) {
    let country_entity: Country = await this.countryEntityService.findByIdWithRegions(country_id);


    
    let days_to_update: Promise<void>[] = [];
    if (country_entity.years != null) {
      for (let i=0; i<country_entity.years.length; i++) {
        if (country_entity.years[i] == days[0].year) {
          // remove all country regions region_id from none_in_regions
          // remove all country_id from none_in_countries
          for (let j=0; j<days.length; j++) {
            let update_done = false;
            if (days[i].none_in_countries_ids != null) {
              let new_years = [];
              for (let j=0; j<days[i].none_in_countries_ids.length; j++) {
              
                if (days[i].none_in_countries_ids[j] != region_entity.id) {
                  new_years.push(days[i].none_in_countries_ids[j]);
                }
              }
              days[i].none_in_countries_ids = new_years;
              update_done = true;
            }
            if (days[i].none_in_regions_ids != null) {
              let new_years = [];
              for (let j=0; j<days[i].none_in_regions_ids.length; j++) {
                
                if (days[i].none_in_regions_ids[j] != region_entity.id) {
                  new_years.push(days[i].none_in_regions_ids[j]);
                }
              }
              days[i].none_in_regions_ids = new_years;
              update_done = true;
            }
            if (update_done) {
              days_to_update.push(this.update(days[i]))
            }
            
          }
        }
      }
    } else {
      if (region_entity.years != null) {
        // remove all region_id from none_in_regions
        for (let i=0; i<days.length; i++) {
          if (days[i].none_in_regions_ids != null) {
            let new_years = [];
            for (let j=0; j<days[i].none_in_regions_ids.length; j++) {
              
              if (days[i].none_in_regions_ids[j] != region_entity.id) {
                new_years.push(days[i].none_in_regions_ids[j]);
              }
            }
            days[i].none_in_regions_ids = new_years;
            days_to_update.push(this.update(days[i]))
          }
        }
      } else {
        throw "Region set for removal of none_in.. doesn't have cached days of year marked in years array." +
        "\nUse of models/day/day.service/DayEntityService/removeRegionFromNoneIn is wrong here."
      }
    }

    if (days_to_update.length != this.daysInYear(days[0].year)) {
      throw "Update incosistency number of update promises is not equal to amount of days for that year";
    } else {
      for (let i=0; i<days_to_update.length; i++) {
        await days_to_update[i];
      }
    }

  }
}
import { Injectable, Inject, HttpException, HttpStatus} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Country } from '../country/country.entity';
import { Region } from '../region/region.entity';
import { Day } from './day.entity';
import { IDayEntity } from './day.interface';
import { IDay } from '../../integrations/holiday_callendar_api/callendar.interface';
import { DescriptorService } from 'src/utilities/descriptor.service';


@Injectable()
export class DayEntityService {
  constructor(
    @Inject('DAY_REPOSITORY')
    private dayRepository: Repository<Day>,
    private readonly cachedD: DescriptorService
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
}
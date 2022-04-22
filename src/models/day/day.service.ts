import { Injectable, Inject, HttpException, HttpStatus} from '@nestjs/common';
import { IsNull, Not, Repository } from 'typeorm';
import { Country } from '../country/country.entity';
import { Region } from '../region/region.entity';
import { Day } from './day.entity';
import { IDayEntity } from './day.interface';
import { IDay } from '../../integrations/holiday_callendar_api/callendar.interface';
import { IDayStatusDate } from 'src/resources/status/status.interface';
import { CountryEntityService } from '../country/country.service';
import { RegionEntityService } from '../region/region.service';
import { WeekDay } from './day.type';
import { MonthDaysArrayService } from '../../utilities/month_days_array/mda.service';


@Injectable()
export class DayEntityService {
  constructor(
    @Inject('DAY_REPOSITORY')
    private dayRepository: Repository<Day>,
    private readonly countryEntityService: CountryEntityService,
    private readonly regionEntityService: RegionEntityService,
    private readonly monthDaysArrayService: MonthDaysArrayService
  ) {}



  /**
   * Prepares holiday days from database to months object list, also sorts by day in each month
   * @param days 
   * @param country_id 
   * @param region_id 
   * @returns Prepared months object list (12 months with none or some days as IDate)
   * @todo rename docs to mda from months object list
   */
  async prepareHolidaysFromDatabaseToResponse(days: Day[], country_id: number, region_id?: number) {
    // use cached object
    // return this.mda.obtainMonthDaysArray().then(
    //   this.mda.mda => {
        // console.log(mda);
        let mda = this.monthDaysArrayService.getMonthDaysArray();
        for (let i=0; i<days.length; i++) {
          let day_is_found = false;
          if (days[i].holiday_in_countries_ids != null) {
            for (let k=0; k<days[i].holiday_in_countries_ids.length; k++) {
              if (days[i].holiday_in_countries_ids[k] == country_id) {

                let dow = new Date(days[i].year, days[i].month-1, days[i].day).getDay() + 1;
                
                mda[(days[i].month-1)].days.push({
                  "year": days[i].year,
                  "month": days[i].month,
                  "day": days[i].day,
                  "dayOfWeek": dow
                })
                day_is_found = true;
                break;
              }
            }
          }
          if (!day_is_found && region_id != undefined) {
            if (days[i].holiday_in_regions_ids != null) {
              for (let k=0; k<days[i].holiday_in_regions_ids.length; k++) {
                if (days[i].holiday_in_regions_ids[k] == region_id) {
  
                  let dow = new Date(days[i].year, days[i].month-1, days[i].day).getDay() + 1;

                  mda[(days[i].month-1)].days.push({
                    "year": days[i].year,
                    "month": days[i].month,
                    "day": days[i].day,
                    "dayOfWeek": dow
                  })
                  day_is_found = true;
                  break;
                }
              }
            }
            
          }
        }
         // finally sort days in each month.
         for (let i = 0; i< mda.length; i++) {
          mda[i].days.sort((a,b) => {return (+a.day) - (+b.day)});
        }
        return mda;
       
      // }
    // )
  }

  /**
   * Prepares holiday days from API response to months object list (obtained data from API must be already sorted)
   * @param days 
   * @returns Prepared months object list (12 months with none or some days as IDate)
   */
  async prepareHolidaysFromCallendarToResponse(days: IDay[]) {
    // use cached object
    // return this.mda.obtainMonthDaysArray().then(
      // mda => {
      let mda = this.monthDaysArrayService.getMonthDaysArray();
        for (let i=0; i<mda.length; i++) {
          let days_to_skip = [];
          for (let j=0; j<days.length; j++) {
            let month = days[j].date.month-1
            if (month == i) {
              // if (days[j].holidayType) // no need to check because response returns only holidays
              let skip = false;
              for (let p=0; p<days_to_skip.length; p++) {
                if (days_to_skip[p] == days[j].date.day) {
                  skip = true;
                  break;
                }
              }
              if (!skip) {
                mda[i].days.push({
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
        return mda;
      // }
    // )
  }


  /**
   * Finds a day by the date from the database
   * @param year 
   * @param month 
   * @param day 
   * @returns found day or undefined
   */
  find_by_date(year: number, month: number, day: number) {
    return this.dayRepository.findOne({
        where: {
            year: year,
            month: month,
            day: day
        }
    });
  }

  /**
   * Finds list of days by year from the database, sorts by months (only)
   * @param year 
   * @returns array of days
   */
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

  /**
   * Finds days by year, but only those which have week_day
   * @param year 
   * @returns 
   */
  findByYearWithWeekDay(year: number) {
    return this.dayRepository.find({
      where: {
        week_day: Not(IsNull()),
        year: year
      },
      order: {
        "month": 'ASC'
      }
    })
  }

  /**
   * Creates a day as a day entity from data, ensures minimally allowed data is set
   * @param d day
   * @returns created day entity (it's not saved yet)
   * @throws prepared HttpException with INTERNAL_SERVER_ERROR
   */
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
        date.week_day = d.week_day;
        
        return this.dayRepository.create(date);
    } else {
        throw new HttpException('Failed to create day, no day/month/year set', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    
  }

  /**
   * Creates an array of created days (from API),
   * adds country (or region) to following workday_in... or holiday_in... arrays
   * @param ds days
   * @param country_id
   * @param region_id
   * @returns list of created days
   */
  create_array(ds: IDay[], country_id: number, region_id?: number) {
    let days: Day[] = [];
    for (let i=0; i<ds.length; i++) {
      let date: IDayEntity = {};

      date.day = ds[i].date.day;
      date.month = ds[i].date.month;
      date.year = ds[i].date.year;
      if (region_id != undefined) {
        if (ds[i].holidayType == 'public_holiday') {
          date.holiday_in_regions_ids = [region_id]
        } else if (ds[i].holidayType = 'extra_working_day') {
          date.workday_in_regions_ids = [region_id]
        }
      } else {
        if (ds[i].holidayType == 'public_holiday') {
          date.holiday_in_countries_ids = [country_id]
        } else if (ds[i].holidayType = 'extra_working_day') {
          date.workday_in_countries_ids = [country_id]
        }
      }
      date.week_day = (ds[i].date.dayOfWeek) as WeekDay;
      days.push(this.dayRepository.create(date));
    }
    return days;
  }


  /**
   * Saves created day entity
   * @param d day_entity
   * @returns day_entity with id
   */
  save(d: Day) {
    return this.dayRepository.save(d);
  }

  /**
   * Saves all days at once (in prepared by ORM query)
   * @param ds day_entities
   * @returns day_entities with their ids
   */
  saveArray(ds: Day[]) {
      return this.dayRepository.save(ds);
  }

  
  /**
   * Executes a query to update given day (must have id)
   * 
   * must provide all holiday_in..., workday_in... arrays
   * required to be saved. If not provided, will overwrite 
   * exitsting with null
   * 
   * @todo add datetime when was the last update/create
   * @param d day_entity
   * @throws if id of day wasn't provided - prepared HttpException, INTERNAL_SERVER_ERROR
   */
  // TODO add datetime when was the last update/create
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
      
      if(d.week_day != undefined) {
        query.set({
          absolute: d.absolute,
          holiday_in_countries_ids: d.holiday_in_countries_ids,
          holiday_in_regions_ids: d.holiday_in_regions_ids,
          workday_in_countries_ids: d.workday_in_countries_ids,
          workday_in_regions_ids: d.workday_in_regions_ids,
          none_in_countries_ids: d.none_in_countries_ids,
          none_in_regions_ids: d.none_in_regions_ids,
          week_day: d.week_day
        });
      } else query.set({
        absolute: d.absolute,
        holiday_in_countries_ids: d.holiday_in_countries_ids,
        holiday_in_regions_ids: d.holiday_in_regions_ids,
        workday_in_countries_ids: d.workday_in_countries_ids,
        workday_in_regions_ids: d.workday_in_regions_ids,
        none_in_countries_ids: d.none_in_countries_ids,
        none_in_regions_ids: d.none_in_regions_ids,
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

  /**
   * Updates days in the database from the obtained in response, if any is different.
   * 
   * Creates new day entity in the database, if it is not found.
   * 
   * If all regions of the country are present under one day (in one in..list), remove all country region_ids and add country_id to the following
   * @param rp_days response days
   * @param db_days days from the database
   * @param db_country_id id of country from the database
   * @param db_country_regions region entities of country
   * @param db_region_id id of region from the database (optional)
   */
  async updateDifferent(
      rp_days: IDay[], 
      db_days: Day[], 
      db_country_id: number,
      db_country_regions: Region[], 
      db_region_id?: number
    ) {
    // array of update promises to await one by one
    let executions: Promise<void>[] = [];
    // array of created day entities
    let creations = [];

    // cycle through days from response
    for (let i=0; i<rp_days.length; i++) {

     

      // saves i of the last element in the day_database array
      let day_database_last_elem_i = db_days.length-1;
      
      // cycle through day entities in the database
      for (let j=0; j<db_days.length; j++) {
        // check if day date matching
        if (rp_days[i].date.year == db_days[j].year
          && rp_days[i].date.month == db_days[j].month
          && rp_days[i].date.year == db_days[j].year
        ) {
          // day is found here

          // check if current day from database requires an update in the database
          let staged_changes = false;

          if (db_days[j].week_day == undefined) {
            db_days[j].week_day = rp_days[i].date.dayOfWeek as WeekDay;
            staged_changes = true;
          }

          // check if region entity was set (if region code was requested)
          if (db_region_id != undefined) {
            // check by ..._in_regions_ids arrays to check if requiring to update
            if (rp_days[i].holidayType == 'public_holiday') {
              // day is public holiday for this region

              let region_is_in_array = false;
              // region id must be present in the day entity, if it is not, change indicator
              if (db_days[j].holiday_in_regions_ids != null)
              for (let p=0; p<db_days[j].holiday_in_regions_ids.length; p++) {
                if (db_days[j].holiday_in_regions_ids[p] == db_region_id) {
                  region_is_in_array = true;
                  break;
                }
              }

              // If region wasn't found, try look at country_id, maybee this day is holiday for all regions of that country
              if (!region_is_in_array) {
                if (db_days[j].holiday_in_countries_ids != null)
                for (let p=0; p<db_days[j].holiday_in_countries_ids.length; p++) {
                  if (db_days[j].holiday_in_countries_ids[p] == db_country_id) {
                    // missleading name
                    // but if the country is found, then all regions are found, hence region of question is found
                    region_is_in_array = true;
                  }
                }
              }

              // update array list if region_id wasn't found
              if (!region_is_in_array) {
                if (db_days[j].holiday_in_regions_ids == null) {
                  db_days[j].holiday_in_regions_ids = [db_region_id]
                } else {
                  db_days[j].holiday_in_regions_ids.push(db_region_id);
                }
                staged_changes = true;
              }

            } else if (rp_days[i].holidayType == 'extra_working_day') {
              // day is a working day
              // region id must be present in the day entity, if it is not, change indicator
              let region_is_in_array = false;
              if (db_days[j].workday_in_regions_ids != null)
              for (let p=0; p<db_days[j].workday_in_regions_ids.length; p++) {
                if (db_days[j].workday_in_regions_ids[p] == db_region_id) {
                  region_is_in_array = true;
                }
              }

              // If region wasn't found, try look at country_id, maybee this day is holiday for all regions of that country
              if (!region_is_in_array) {
                if (db_days[j].workday_in_countries_ids != null)
                for (let p=0; p<db_days[j].workday_in_countries_ids.length; p++) {
                  if (db_days[j].workday_in_countries_ids[p] == db_country_id) {
                    // missleading name
                    // but if the country is found, then all regions are found, hence region of question is found
                    region_is_in_array = true;
                  }
                }
              }

              if (!region_is_in_array) {
                if (db_days[j].workday_in_regions_ids == null) {
                  db_days[j].workday_in_regions_ids = [db_region_id]
                } else {
                  db_days[j].workday_in_regions_ids.push(db_region_id);
                }
                staged_changes = true;
              }
            }

            // check to see if all regions were saved to workday_in.. or holiday_in.. arrays
            // if all regions are saved, empty list from occurencies and save country_id 
            // to workday_in.. or holiday_in..

            let total_number_of_regions = db_country_regions.length;
            if (db_days[j].holiday_in_regions_ids != null)
            if (db_days[j].holiday_in_regions_ids.length == total_number_of_regions) {
              let counter = total_number_of_regions;
              for (let p=0; p<db_days[j].holiday_in_regions_ids.length; p++) {
                for (let z=0; z<db_country_regions.length; z++) {
                  if (db_country_regions[z].id == db_days[j].holiday_in_regions_ids[z]) {
                    counter -= 1;
                    delete db_days[j].holiday_in_regions_ids[z];
                  }
                }
              }

              if (counter == 0) {
                // prepare new list, keeping regions not from country of question
                let new_regions_list = [];
                for (let l=0; l<db_days[j].holiday_in_regions_ids.length; l++) {
                  if (db_days[j].holiday_in_regions_ids[l] != undefined) {
                    new_regions_list.push(db_days[j].holiday_in_regions_ids[l]);
                  }
                }
                db_days[j].holiday_in_regions_ids = new_regions_list;

                if (db_days[j].holiday_in_countries_ids != null) {
                  db_days[j].holiday_in_countries_ids = [db_country_id]
                } else {
                  db_days[j].holiday_in_countries_ids.push(db_country_id);
                }
                // this change should not be required here, but keep it just in case(?)
                staged_changes = true;
              }
            }
            if (staged_changes) {
              // push update if there're any changes
              executions.push(this.update(db_days[j]));
            }
            // day was surely found, no need to loop more days
            break;

          } else {
            // region entity not found, check by country only

            if (rp_days[i].holidayType == 'public_holiday') {
              let counry_is_in_array = false;
              if (db_days[j].holiday_in_countries_ids != null)
              for (let p=0; p<db_days[j].holiday_in_countries_ids.length; p++) {
                if (db_days[j].holiday_in_countries_ids[p] == db_country_id) {
                  counry_is_in_array = true;
                }
              }
              if (!counry_is_in_array) {
                if (db_days[j].holiday_in_countries_ids != null) {
                  db_days[j].holiday_in_countries_ids.push(db_country_id);
                } else {
                  db_days[j].holiday_in_countries_ids = [db_country_id];
                }
                staged_changes = true;
              }
            } else if (rp_days[i].holidayType == 'extra_working_day') {
              let country_is_in_array = false;
              if (db_days[j].workday_in_countries_ids != null)
              for (let p=0; p<db_days[j].workday_in_countries_ids.length; p++) {
                if (db_days[j].workday_in_countries_ids[p] == db_country_id) {
                  country_is_in_array = true;
                }
              }
              if (!country_is_in_array) {
                if (db_days[j].workday_in_countries_ids != null) {
                  db_days[j].workday_in_countries_ids.push(db_country_id);
                } else {
                  db_days[j].workday_in_countries_ids = [db_country_id];
                }
                staged_changes = true;
              }
            }
          }
          if (staged_changes) {
            // push update if there're any changes
            executions.push(this.update(db_days[j]));
          }
          // day was surely found, no need to loop more days
          break;
        } else {
          if (j == day_database_last_elem_i) {
            // day from response wasn't found in any database saved days
            // create a new day
            let day = new Day();
            day.day = rp_days[i].date.day;
            day.month = rp_days[i].date.month;
            day.year = rp_days[i].date.year;
            day.week_day = rp_days[i].date.dayOfWeek as WeekDay;

            if (db_region_id != undefined) {
              if (rp_days[i].holidayType == 'public_holiday') {
                day.holiday_in_regions_ids = [db_region_id];
              } else if (rp_days[i].holidayType = 'extra_working_day') {
                day.workday_in_regions_ids = [db_region_id];
              
            } else {
              if (rp_days[i].holidayType == 'public_holiday') {
                day.holiday_in_countries_ids = [db_country_id];
              } else if (rp_days[i].holidayType = 'extra_working_day') {
                day.workday_in_countries_ids = [db_country_id]
              }
            }
            // push created day entity to creations to execute save as array
            creations.push(this.create(day));
            }

            // no need more comparing in for loop
            break;
          }
        }
      }
    }
    // await updates
    for (let i=0; i< executions.length; i++) {
      await executions[i]
    }

    // creates all days at once
    if (creations.length > 0) {
      await this.saveArray(creations)
    }
  }

  /**
   * Saves new day to the database
   * 
   * (there's no check whether or not this is the 365th or 366th day of country/region, 
   * to identify if whole year is cached) 
   * 
   * @param rp_day day from the response
   * @param req_date requested date (year, month, year)
   * @param db_country_id 
   * @param db_region_id 
   * @returns saved day
   */
  createOneDayFromResponse(
    rp_day: IDay, 
    req_date: IDayStatusDate, 
    db_country_id: number, 
    db_region_id?: number
  ) {
    let new_day: IDayEntity = {};
    if (rp_day == null) {
      new_day.day = req_date.day;
      new_day.month = req_date.month;
      new_day.year = req_date.year;

      if (db_region_id != undefined) {
        new_day.none_in_regions_ids = [db_region_id]
      } else {
        new_day.none_in_countries_ids = [db_country_id]
      }

    } else {
      new_day.day = rp_day.date.day;
      new_day.month = rp_day.date.month;
      new_day.year = rp_day.date.year;
      new_day.week_day = rp_day.date.dayOfWeek as WeekDay;

      if (rp_day.holidayType == 'public_holiday') {
        if (db_region_id != undefined) {
          new_day.holiday_in_regions_ids = [db_region_id];
        } else {
          new_day.holiday_in_countries_ids = [db_country_id];
        }
      } else {
        if (db_region_id != undefined) {
          new_day.workday_in_regions_ids = [db_region_id];
        } else {
          new_day.workday_in_countries_ids = [db_country_id]
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
   * @param rp_day day from the response
   * @param db_day day from the database
   * @param db_country_id 
   * @param db_country_regions
   * @param db_country_years
   * @param db_region_id 
   */
  async updateOneDayFromResponse(
    rp_day: IDay, 
    db_day: Day, 
    db_country_id: number, 
    db_country_regions: Region[], 
    db_country_years: number[],
    db_region_id?: number
  ) {
    let region_added = false;
    let country_added = false;
    if (rp_day == null) {
      // update to none_in...
      if (db_region_id != undefined) {
        if (db_day.none_in_regions_ids == null) {
          db_day.none_in_regions_ids = [db_region_id];
        } else {
          db_day.none_in_regions_ids.push(db_region_id)
        }
        region_added = true;
      } else {
        if (db_day.none_in_countries_ids == null) {
          db_day.none_in_countries_ids = [db_country_id];
        } else {
          db_day.none_in_countries_ids.push(db_country_id);
        }
        country_added = true;
      }
    } else {
      // check if week_day is saved...
      if (db_day.week_day == undefined) {
        db_day.week_day = rp_day.date.dayOfWeek as WeekDay;
      }
      // find out what list to update, regions or country
      if (rp_day.holidayType == 'public_holiday') {
        if (db_region_id != undefined) {
          if (db_day.holiday_in_regions_ids == null) {
            db_day.holiday_in_regions_ids = [db_region_id];
          } else {
            db_day.holiday_in_regions_ids.push(db_region_id)
          }
          region_added = true;
        } else {
          if (db_day.holiday_in_countries_ids == null) {
            db_day.holiday_in_countries_ids = [db_country_id];
          } else {
            db_day.holiday_in_countries_ids.push(db_country_id);
          }
          country_added = true;
        }
      } else {
        // its workday (results from response should either have one)
        if (db_region_id != undefined) {
          if (db_day.workday_in_regions_ids == null) {
            db_day.workday_in_regions_ids = [db_region_id];
          } else {
            db_day.workday_in_regions_ids.push(db_region_id)
          }
          region_added = true;
        } else {
          if (db_day.workday_in_countries_ids == null) {
            db_day.workday_in_countries_ids = [db_country_id];
          } else {
            db_day.workday_in_countries_ids.push(db_country_id);
          }
          country_added = true;
        }
      }
    }

    // now check if regions are totalled in day (if all regions from country are contained in day)
    // under any result save day to database, will require it later when checking all days (to see if need to update cached year for country/region)
    if (region_added) {
      await this.update(this.trySwitchRegionIdToCountryId(db_country_id, db_country_regions, db_day));
    } else {
      if (country_added) {
       await this.update(this.tryRemoveRegions(db_day, db_country_id, db_country_regions))
      } else {
        await this.update(db_day);
      }
    }
    
    
    // after this need to check day for - each id from either country_id or region_id.
    // that is to make value absolute, which states, that this day was checked by every country and region, therefore removing ids from none_in.. array

    // if for example currently observed day is 365th of 365 days year, need to update either country or region cached year.
    // if country or region cached year gets modified, then remove country_id or region_id from none_in...
    let db_days_of_year = await this.findByYear(db_day.year);
    if (db_region_id != undefined) {
      // same thing for regions
      await this.tryUpdateRegionCachedYear(
        db_country_id, 
        db_country_regions, 
        db_country_years, 
        db_region_id, 
        db_days_of_year, 
        db_day.year
      );
    } else {
        await this.tryUpdateCountryCachedYear(db_country_id, db_country_years, db_days_of_year, db_day.year);
    }

    // dont forget to check if day absolute
    if(await this.isDayEligableToBeAbsolute(db_day)) {
      await this.makeDayAbsolute(db_day.id);
    }


  }

  /**
   * Try to update country cached year 
   * (verifying that ALL days are saved under requested year)
   * 
   * It updates country year if ALL days contain country_id anywhere 
   * ...in... AND removes country_id from none_in...
   * 
   * @param db_country_id 
   * @param db_country_years
   * @param db_days all found in the database days for specified year
   * @param year 
   */
  async tryUpdateCountryCachedYear(
    db_country_id: number, 
    db_country_years: number[],
    db_days: Day[], 
    year: number
  ) {
    if (this.doesCountryRequireUpdateOfYear(db_country_id, db_days, year)) {
      // country has all days cached for specified year.
      await this.countryEntityService.add_year(db_country_id, db_country_years, year);
      await this.removeCountryFromNoneIn(db_country_id, db_days);
    }
  }

  /**
   * Try to update region cached year 
   * (verifying that ALL days are saved under requested year)
   * 
   * It updates region year if ALL days contain region_id or country_id 
   * anywhere ...in... AND removes region_id from none_in...
   * 
   * @param db_country_id
   * @param db_country_regions
   * @param db_country_years 
   * @param db_region_id 
   * @param db_days all found in the database days for specified year
   * @param year 
   * @throws error(string) if region entity wasn't found in given country 
   * (done for debug, due region_id must be provided correct)
   */
  async tryUpdateRegionCachedYear(
    db_country_id: number,
    db_country_regions: Region[],
    db_country_years: number[],
    db_region_id: number, 
    db_days: Day[], 
    year: number
    ) {
    if (this.doesRegionRequireUpdateOfYear(db_country_id, db_region_id, db_days, year)) {
      let region_entity: Region = undefined;
      for (let i=0; i<db_country_regions.length; i++) {
        if (db_country_regions[i].id == db_region_id) {
          region_entity = db_country_regions[i];
          break;
        }
      }
      if (region_entity == undefined) {
        throw "Can't find region_entity in country_entity, although region_id was provided (?)";
      }
      await this.regionEntityService.add_year(region_entity, year, db_country_id, db_country_regions, db_country_years);
      // remove all none_in.. for all regions
      // check by the country updated and region
      await this.removeRegionFromNoneIn(db_country_id, region_entity.id, region_entity.years, db_days);
    }
  }

  /**
   * Try to find if all regions are under one list in day
   * 
   * If they all are, delete all regions of that country AND add country to following list
   * @param db_country_id
   * @param db_country_regions 
   * @param db_day 
   * @todo rewrite codebase from array to Array to minimize size of such checks with use of inner functions
   * @returns day, which is required to update
   */
  trySwitchRegionIdToCountryId(db_country_id: number, db_country_regions: Region[], db_day: Day) {
    
    if (db_country_regions.length == 0) return db_day;

    

    let regions_ids_check_list: number[] = [];
    for (let i=0; i<db_country_regions.length; i++) {
      regions_ids_check_list.push(db_country_regions[i].id);
    }

    // this identifies if transition from every region_id from country was made
    let transition_made = false;

    // this list will add regions that are not part of the county_entity under scope
    let new_some_in_list: number[] = [];
    // this list will populate if delete ever occured, but only used if all regions of country are present under one list (holiday_in_regions_ids)

    if (db_day.holiday_in_regions_ids != null) {
      if (db_day.holiday_in_regions_ids.length >= db_country_regions.length) {

        // checks if delete ever happened
        let delete_happened = false;
        for (let i=0; db_day.holiday_in_regions_ids.length; i++) {
          // checks if delete occured under in the scope of this day
          let delete_occured = false;
          for (let j=0; j<regions_ids_check_list.length; j++) {
            if (regions_ids_check_list[j] != undefined) {

              if (regions_ids_check_list[j] == db_day.holiday_in_regions_ids[i]) {
                delete_occured = true;
                delete regions_ids_check_list[i];
                if (!delete_happened) {
                  delete_happened = true;
                }
              }
            }
          }
          if (!delete_occured) {
            new_some_in_list.push(db_day.holiday_in_regions_ids[i]);
          }
        }
        if (delete_happened) {
          regions_ids_check_list.filter(v => {
            return v != undefined
          });
          if (regions_ids_check_list.length == 0) {
            // all regions are present under one list
            db_day.holiday_in_regions_ids = new_some_in_list;
            if (db_day.holiday_in_countries_ids != null) {
              db_day.holiday_in_countries_ids.push(db_country_id);
            } else {
              db_day.holiday_in_countries_ids = [db_country_id];
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
      if (db_country_regions.length != regions_ids_check_list.length) {
        regions_ids_check_list = [];
        for (let i=0; i<db_country_regions.length; i++) {
          regions_ids_check_list.push(db_country_regions[i].id);
        }
      }

      // the reason for duplicating code is that methods returning the result (2 variables) can't be replaced directly to current variables
      // meaning we need to alocate more memory for storing return value and then replacing variables that we need with it (at least)
      // in any way duplication of data will take place if we want to change not exactly that list, but any list, given the input.
      // short --> can pass object by reference, can't pass array of object by reference

      // I later found that with use of Array class it will be an object, but in this case much has to be rewritten

      // Overall it is required to change whole approach to more OOP in the whole project. 
      // Provide Country, Region and Day as object classes 
      // with Iterators, inheritance and other. 

      if (db_day.workday_in_regions_ids != null) {
        if (db_day.workday_in_regions_ids.length >= db_country_regions.length) {
  
          // checks if delete ever happened
          let delete_happened = false;
          for (let i=0; db_day.workday_in_regions_ids.length; i++) {
            // checks if delete occured under in the scope of this day
            let delete_occured = false;
            for (let j=0; j<regions_ids_check_list.length; j++) {
              if (regions_ids_check_list[j] != undefined) {
  
                if (regions_ids_check_list[j] == db_day.workday_in_regions_ids[i]) {
                  delete_occured = true;
                  delete regions_ids_check_list[i];
                  if (!delete_happened) {
                    delete_happened = true;
                  }
                }
              }
            }
            if (!delete_occured) {
              new_some_in_list.push(db_day.workday_in_regions_ids[i]);
            }
          }
          if (delete_happened) {
            regions_ids_check_list.filter(v => {
              return v != undefined
            });
            if (regions_ids_check_list.length == 0) {
              // all regions are present under one list
              db_day.workday_in_regions_ids = new_some_in_list;
              if (db_day.workday_in_countries_ids != null) {
                db_day.workday_in_countries_ids.push(db_country_id);
              } else {
                db_day.workday_in_countries_ids = [db_country_id];
              }
              transition_made = true;
            }
          }
        }
      }

      if (!transition_made) {
        // but clean and populate lists if required
        new_some_in_list = [];
        if (db_country_regions.length != regions_ids_check_list.length) {
          regions_ids_check_list = [];
          for (let i=0; i<db_country_regions.length; i++) {
            regions_ids_check_list.push(db_country_regions[i].id);
          }
        }

        if (db_day.none_in_regions_ids != null) {
          if (db_day.none_in_regions_ids.length >= db_country_regions.length) {
    
            // checks if delete ever happened
            let delete_happened = false;
            for (let i=0; db_day.none_in_regions_ids.length; i++) {
              // checks if delete occured under in the scope of this day
              let delete_occured = false;
              for (let j=0; j<regions_ids_check_list.length; j++) {
                if (regions_ids_check_list[j] != undefined) {
    
                  if (regions_ids_check_list[j] == db_day.none_in_regions_ids[i]) {
                    delete_occured = true;
                    delete regions_ids_check_list[i];
                    if (!delete_happened) {
                      delete_happened = true;
                    }
                  }
                }
              }
              if (!delete_occured) {
                new_some_in_list.push(db_day.none_in_regions_ids[i]);
              }
            }
            if (delete_happened) {
              regions_ids_check_list.filter(v => {
                return v != undefined
              });
              if (regions_ids_check_list.length == 0) {
                // all regions are present under one list
                db_day.none_in_regions_ids = new_some_in_list;
                if (db_day.none_in_countries_ids != null) {
                  db_day.none_in_countries_ids.push(db_country_id);
                } else {
                  db_day.none_in_countries_ids = [db_country_id];
                }
                transition_made = true;
              }
            }
          }
        }

      }
    }

    return db_day;

  }

  /**
   * Try to find if all regions are under one list in day
   * 
   * If they all are, delete all regions of that country
   * @param db_day 
   * @param db_country_id
   * @param db_country_regions 
   * @returns changed (or not) day entity
   */
  tryRemoveRegions(db_day: Day, db_country_id: number, db_country_regions: Region[]) {
    // check if any countries list has the country_id to remove all regions of that country from the same list
    if (db_country_regions.length == 0) {
      return db_day;
    }

    // this list will add regions that are not part of the county_entity under scope
    let new_some_in_list: number[] = [];
    // this list will populate if delete ever occured, but only used if all regions of country are present under one list (holiday_in_regions_ids)

    // this identifies if transition from every region_id from country was made
    let clearing_made = false;

    let regions_ids_check_list: number[] = [];
    for (let i=0; i<db_country_regions.length; i++) {
      regions_ids_check_list.push(db_country_regions[i].id);
    }

    if (db_day.holiday_in_countries_ids != null) {

      for (let i=0; i<db_day.holiday_in_countries_ids.length; i++) {
        if (db_country_id = db_day.holiday_in_countries_ids[i]) {

          if (db_day.holiday_in_regions_ids != null)
          if (db_day.holiday_in_regions_ids.length >= db_country_regions.length) {
            
              // checks if delete ever happened
              let delete_happened = false;
              for (let i=0; db_day.holiday_in_regions_ids.length; i++) {
                // checks if delete occured under in the scope of this day
                let delete_occured = false;
                for (let j=0; j<regions_ids_check_list.length; j++) {
                  if (regions_ids_check_list[j] != undefined) {
      
                    if (regions_ids_check_list[j] == db_day.holiday_in_regions_ids[i]) {
                      delete_occured = true;
                      delete regions_ids_check_list[i];
                      if (!delete_happened) {
                        delete_happened = true;
                      }
                    }
                  }
                }
                if (!delete_occured) {
                  new_some_in_list.push(db_day.holiday_in_regions_ids[i]);
                }
              }
              if (delete_happened) {
                regions_ids_check_list.filter(v => {
                  return v != undefined
                });
                if (regions_ids_check_list.length == 0) {
                  // all regions are present under one list
                  db_day.holiday_in_regions_ids = new_some_in_list;
                  
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

      if (db_day.workday_in_countries_ids != null) {
        for (let i=0; i<db_day.workday_in_countries_ids.length; i++) {
          if (db_country_id = db_day.workday_in_countries_ids[i]) {
            new_some_in_list = [];
            
            if (db_country_regions.length != regions_ids_check_list.length) {
              regions_ids_check_list = [];
              for (let i=0; i<db_country_regions.length; i++) {
                regions_ids_check_list.push(db_country_regions[i].id);
              }
            }

            // checks if delete ever happened
            let delete_happened = false;

            if (db_day.workday_in_regions_ids != null)
            for (let i=0; db_day.workday_in_regions_ids.length; i++) {
              // checks if delete occured under in the scope of this day
              let delete_occured = false;
              for (let j=0; j<regions_ids_check_list.length; j++) {
                if (regions_ids_check_list[j] != undefined) {
    
                  if (regions_ids_check_list[j] == db_day.workday_in_regions_ids[i]) {
                    delete_occured = true;
                    delete regions_ids_check_list[i];
                    if (!delete_happened) {
                      delete_happened = true;
                    }
                  }
                }
              }
              if (!delete_occured) {
                new_some_in_list.push(db_day.workday_in_regions_ids[i]);
              }
            }
            if (delete_happened) {
              regions_ids_check_list.filter(v => {
                return v != undefined
              });
              if (regions_ids_check_list.length == 0) {
                // all regions are present under one list
                db_day.workday_in_regions_ids = new_some_in_list;
                
                clearing_made = true;
              }
            }
          }
        }
         
        
      }

      if (!clearing_made) {
        if (db_day.none_in_countries_ids != null) {
          for (let i=0; i<db_day.none_in_countries_ids.length; i++) {
            if (db_country_id = db_day.none_in_countries_ids[i]) {
              new_some_in_list = [];
              if (db_country_regions.length != regions_ids_check_list.length) {
                regions_ids_check_list = [];
                for (let i=0; i<db_country_regions.length; i++) {
                  regions_ids_check_list.push(db_country_regions[i].id);
                }
              }
  
              // checks if delete ever happened
              let delete_happened = false;

              if (db_day.none_in_regions_ids != null)
              for (let i=0; db_day.none_in_regions_ids.length; i++) {
                // checks if delete occured under in the scope of this day
                let delete_occured = false;
                for (let j=0; j<regions_ids_check_list.length; j++) {
                  if (regions_ids_check_list[j] != undefined) {
      
                    if (regions_ids_check_list[j] == db_day.none_in_regions_ids[i]) {
                      delete_occured = true;
                      delete regions_ids_check_list[i];
                      if (!delete_happened) {
                        delete_happened = true;
                      }
                    }
                  }
                }
                if (!delete_occured) {
                  new_some_in_list.push(db_day.none_in_regions_ids[i]);
                }
              }
              if (delete_happened) {
                regions_ids_check_list.filter(v => {
                  return v != undefined
                });
                if (regions_ids_check_list.length == 0) {
                  // all regions are present under one list
                  db_day.none_in_regions_ids = new_some_in_list;
                  
                  clearing_made = true;
                }
              }
            }
          }
        }
      }

    }


    return db_day;
  }

  /**
   * Find out if the day is eligable to be absolute (if all coutries/regions are existing in every list of day)
   * 
   * If it is, clear none_in...
   * @param db_day 
   * @returns 
   */
  async isDayEligableToBeAbsolute(db_day: Day): Promise<boolean> {
    // csrs = CountrieS + RegionS
    // cr = Country + Region
    return await this.countryEntityService.findAllWithRegions().then(async csrs => {
      if (csrs.length == 0) {
        throw "Can't try value for absolute eligability if no countries are present";
      }
      // there's a chance that this day was the only day checked by all countries and their regions without requesting all days for this year.
      if (db_day.holiday_in_countries_ids != null && db_day.workday_in_countries_ids != null && db_day.none_in_regions_ids != null)
      if (db_day.holiday_in_countries_ids.length + db_day.workday_in_countries_ids.length + db_day.none_in_countries_ids.length == csrs.length) {
        // day.absolute = true;
        return true;
      } else {
        let n_of_countries_without_regions = 0;
        for (let i=0; i<csrs.length; i++) {
          if (csrs[i].regions.length == 0) {
            n_of_countries_without_regions++;
          }
        }
        if (db_day.holiday_in_countries_ids.length + db_day.workday_in_countries_ids.length + db_day.none_in_countries_ids.length >= n_of_countries_without_regions) {
          let countries_not_found: Country[] = [];
          for (let i=0; i<csrs.length; i++) {
            let not_found = true;
            if (db_day.none_in_countries_ids != null) {
              for (let j=0; j<db_day.none_in_countries_ids.length; j++) {
                if (db_day.none_in_countries_ids[j] != undefined) {
                  if (db_day.none_in_countries_ids[j] == csrs[i].id) {
                    not_found = false;
                    delete db_day.none_in_countries_ids[j];
                  }
                }
              }
            }
            if (not_found) {
              if (db_day.holiday_in_countries_ids != null) {
                for (let j=0; j<db_day.holiday_in_countries_ids.length; j++) {
                  if (db_day.holiday_in_countries_ids[j] != undefined) {
                    if (db_day.holiday_in_countries_ids[j] == csrs[i].id) {
                      not_found = false;
                      delete db_day.holiday_in_countries_ids[j];
                    }
                  }
                }
              }
              if (not_found) {
                if (db_day.workday_in_countries_ids != null) {
                  for (let j=0; j<db_day.workday_in_countries_ids.length; j++) {
                    if (db_day.workday_in_countries_ids[j] != undefined) {
                      if (db_day.workday_in_countries_ids[j] == csrs[i].id) {
                        not_found = false;
                        delete db_day.workday_in_countries_ids[j];
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
              if (db_day.none_in_regions_ids != null) {
                for (let j=0; j<db_day.none_in_regions_ids.length; j++) {


                  if (db_day.none_in_regions_ids[j] != undefined) {
                    // each region
                    for (let p=0; countries_not_found[i].regions.length; p++) {
                      if (countries_not_found[i].regions[p] !=undefined) {
                        if (countries_not_found[i].regions[p].id == db_day.none_in_regions_ids[j]) {
                          not_found = false;
                          delete db_day.none_in_regions_ids[j];
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
                if (db_day.holiday_in_regions_ids != null) {
                  for (let j=0; j<db_day.holiday_in_regions_ids.length; j++) {


                    if (db_day.holiday_in_regions_ids[j] != undefined) {
                      // each region
                      for (let p=0; countries_not_found[i].regions.length; p++) {
                        if (countries_not_found[i].regions[p] !=undefined) {
                          if (countries_not_found[i].regions[p].id == db_day.holiday_in_regions_ids[j]) {
                            not_found = false;
                            delete db_day.holiday_in_regions_ids[j];
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
                  if (db_day.workday_in_regions_ids != null) {
                    for (let j=0; j<db_day.workday_in_regions_ids.length; j++) {
  
  
                      if (db_day.workday_in_regions_ids[j] != undefined) {
                        // each region
                        for (let p=0; countries_not_found[i].regions.length; p++) {
                          if (countries_not_found[i].regions[p] !=undefined) {
                            if (countries_not_found[i].regions[p].id == db_day.workday_in_regions_ids[j]) {
                              not_found = false;
                              delete db_day.workday_in_regions_ids[j];
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

  /**
   * Updates day to absolute (all countries/regions are saved under this day)
   * @param db_day_id 
   * @returns 
   */
  makeDayAbsolute(db_day_id: number) {
    return this.dayRepository
    .createQueryBuilder()
    .update()
    .set({
      none_in_countries_ids: null,
      none_in_regions_ids: null,
      absolute: true
    })
    .where("id = :id", { id: db_day_id })
    .execute();
  }

  /**
   * @param year 
   * @returns number of days for requested year
   */
  daysInYear(year: number) {
    return ((year % 4 === 0 && year % 100 > 0) || year %400 == 0) ? 366: 365;
  }

  /**
   * Checks if ALL days contain country_id anywhere in lists
   * 
   * By holiday_in..., then in workday_in..., finally in none_in...
   * @param db_country_id 
   * @param db_days 
   * @param year 
   * @todo change to first check by none_in..., then by holiday_in, finally by workday_in... to optimise?
   * @returns 
   */
  doesCountryRequireUpdateOfYear(db_country_id: number, db_days: Day[], year: number) {
    if (db_days.length == this.daysInYear(year)) {

      for (let i=0; i<db_days.length; i++) {
        let day_deleted = false;
        if (db_days[i].holiday_in_countries_ids != null) {
          for (let j=0; j<db_days[i].holiday_in_countries_ids.length; j++) {
            if (db_days[i].holiday_in_countries_ids[j] == db_country_id) {
              delete db_days[i];
              day_deleted = true;
              break;
            }
          }
        }
        if (!day_deleted) {
          if (db_days[i].workday_in_countries_ids != null) {
            for (let j=0; j<db_days[i].workday_in_countries_ids.length; j++) {
              if (db_days[i].workday_in_countries_ids[j] == db_country_id) {
                delete db_days[i];
                day_deleted = true;
                break;
              }
            }
          }
        }
          if (db_days[i].none_in_countries_ids != null) {
            for (let j=0; j<db_days[i].none_in_countries_ids.length; j++) {
              if (db_days[i].none_in_countries_ids[j] == db_country_id) {
                delete db_days[i];
                break;
              }
            }
          } else return false;
      }

      return true;

    } else return false;
  }

  /**
   * Remove country_id from none_in... for given db_days
   * @param db_country_id 
   * @param db_days 
   */
  async removeCountryFromNoneIn(db_country_id: number, db_days: Day[]) {
    // no check for amount of days because prior to this doesCountryRequireUpdateOfYear must be executed
    let updates: Promise<void>[] = [];
    for (let i=0; i<db_days.length; i++) {
      if (db_days[i].none_in_countries_ids != null) {
        for (let j=0; j<db_days[i].none_in_countries_ids.length; j++) {
          if (db_days[i].none_in_countries_ids[j] == db_country_id) {
            delete db_days[i].none_in_countries_ids[i];

            db_days[i].none_in_countries_ids.filter(v => {
              return v != undefined
            })
          }
        }
      }
      updates.push(this.update(db_days[i]));
    }

    for (let i=0; i<updates.length; i++) {
      await updates[i]
    }

  }

  /**
   * Checks if ALL days contain region_id or country_id anywhere in lists
   * 
   * First checks by country_id, then by region_id
   * 
   * By holiday_in..., then in workday_in..., finally in none_in...
   * @param db_country_id 
   * @param db_region_id 
   * @param db_days 
   * @param year 
   * @todo change to first check by none_in..., then by holiday_in, finally by workday_in... to optimise?
   * @returns 
   */
  doesRegionRequireUpdateOfYear(db_country_id: number, db_region_id: number, db_days: Day[], year: number) {
    if (db_days.length == this.daysInYear(year)) {
      
      for (let i=0; i<db_days.length; i++) {
        let day_deleted = false;
        if (db_days[i].holiday_in_countries_ids != null) {
          for (let j=0; j<db_days[i].holiday_in_countries_ids.length; j++) {
            if (db_days[i].holiday_in_countries_ids[j] == db_country_id) {
              delete db_days[i];
              day_deleted = true;
              break;
            }
          }
          if (!day_deleted) {
            for (let j=0; j<db_days[i].holiday_in_regions_ids.length; j++) {
              if (db_days[i].holiday_in_regions_ids[j] == db_region_id) {
                delete db_days[i];
                day_deleted = true;
                break;
              }
            }
          }
        } else {
          if (db_days[i].holiday_in_regions_ids != null) {
            for (let j=0; j<db_days[i].holiday_in_regions_ids.length; j++) {
              if (db_days[i].holiday_in_regions_ids[j] == db_region_id) {
                delete db_days[i];
                day_deleted = true;
                break;
              }
            }
          }
        }


        if (day_deleted) {
          continue;
        } else {
          if (db_days[i].workday_in_countries_ids != null) {
            for (let j=0; j<db_days[i].workday_in_countries_ids.length; j++) {
              if (db_days[i].workday_in_countries_ids[j] == db_country_id) {
                delete db_days[i];
                day_deleted = true;
                break;
              }
            }
            if (!day_deleted) {
              for (let j=0; j<db_days[i].workday_in_regions_ids.length; j++) {
                if (db_days[i].workday_in_regions_ids[j] == db_region_id) {
                  delete db_days[i];
                  day_deleted = true;
                  break;
                }
              }
            }
          } else {
            if (db_days[i].workday_in_regions_ids != null) {
              for (let j=0; j<db_days[i].workday_in_regions_ids.length; j++) {
                if (db_days[i].workday_in_regions_ids[j] == db_region_id) {
                  delete db_days[i];
                  day_deleted = true;
                  break;
                }
              }
            }
          }
        }

        if (!day_deleted) {
          if (db_days[i].none_in_countries_ids != null) {
            for (let j=0; j<db_days[i].none_in_countries_ids.length; j++) {
              if (db_days[i].none_in_countries_ids[j] == db_country_id) {
                delete db_days[i];
                day_deleted = true;
                break;
              }
            }
            if (!day_deleted) {
              for (let j=0; j<db_days[i].none_in_regions_ids.length; j++) {
                if (db_days[i].none_in_regions_ids[j] == db_region_id) {
                  delete db_days[i];
                  day_deleted = true;
                  break;
                }
              }
            }
          } else {
            if (db_days[i].none_in_regions_ids != null) {
              for (let j=0; j<db_days[i].none_in_regions_ids.length; j++) {
                if (db_days[i].none_in_regions_ids[j] == db_region_id) {
                  delete db_days[i];
                  day_deleted = true;
                  break;
                }
              }
            }
          }
        } else return false;

        return true;

      }
    } else return false;
  }

  /**
   * Removes all region_id from none_in...
   * @param db_country_id 
   * @param db_region_id
   * @param db_region_years 
   * @param db_days 
   * @throws error(string)
   */
  async removeRegionFromNoneIn(db_country_id: number, db_region_id: number, db_region_years: number[], db_days: Day[]) {
    let country_entity: Country = await this.countryEntityService.findByIdWithRegions(db_country_id);


    
    let days_to_update: Promise<void>[] = [];
    if (country_entity.years != null) {
      for (let i=0; i<country_entity.years.length; i++) {
        if (country_entity.years[i] == db_days[0].year) {
          // remove all country regions region_id from none_in_regions
          // remove all country_id from none_in_countries
          for (let j=0; j<db_days.length; j++) {
            let update_done = false;
            // if (days[i].none_in_countries_ids != null) {
            //   let new_years = [];
            //   for (let j=0; j<days[i].none_in_countries_ids.length; j++) {
              
            //     if (days[i].none_in_countries_ids[j] != country_id) {
            //       new_years.push(days[i].none_in_countries_ids[j]);
            //     }
            //   }
            //   days[i].none_in_countries_ids = new_years;
            //   update_done = true;
            // }
            if (db_days[i].none_in_regions_ids != null) {
              let new_years = [];
              for (let j=0; j<db_days[i].none_in_regions_ids.length; j++) {
                
                if (db_days[i].none_in_regions_ids[j] != db_region_id) {
                  new_years.push(db_days[i].none_in_regions_ids[j]);
                }
              }
              db_days[i].none_in_regions_ids = new_years;
              update_done = true;
            }
            if (update_done) {
              days_to_update.push(this.update(db_days[i]))
            }
            
          }
        }
      }
    } else {
      if (db_region_years != null) {
        // remove all region_id from none_in_regions
        for (let i=0; i<db_days.length; i++) {
          if (db_days[i].none_in_regions_ids != null) {
            let new_years = [];
            for (let j=0; j<db_days[i].none_in_regions_ids.length; j++) {
              
              if (db_days[i].none_in_regions_ids[j] != db_region_id) {
                new_years.push(db_days[i].none_in_regions_ids[j]);
              }
            }
            db_days[i].none_in_regions_ids = new_years;
            days_to_update.push(this.update(db_days[i]))
          }
        }
      } else {
        throw "Region set for removal of none_in.. doesn't have cached days of year marked in years array." +
        "\nUse of models/day/day.service/DayEntityService/removeRegionFromNoneIn is wrong here."
      }
    }

    if (days_to_update.length != this.daysInYear(db_days[0].year)) {
      throw "Update incosistency number of update promises is not equal to amount of days for that year";
    } else {
      for (let i=0; i<days_to_update.length; i++) {
        await days_to_update[i];
      }
    }

  }
}
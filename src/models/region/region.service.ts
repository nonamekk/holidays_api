import { Injectable, Inject, HttpException, HttpStatus, forwardRef } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Country } from '../country/country.entity';
import { CountryEntityService } from '../country/country.service';
import { Region } from './region.entity';

@Injectable()
export class RegionEntityService {
  constructor(
    @Inject('REGION_REPOSITORY')
    private regionRepository: Repository<Region>,
    @Inject(forwardRef(() => CountryEntityService))
    private readonly countryEntityService: CountryEntityService
  ) {}

  /**
   * Creates region entity
   * @param region_code 
   * @param db_country 
   * @returns 
   */
  create(region_code: string, db_country: Country) {
    const region = new Region();
    region.code = region_code;
    region.country = db_country;
    return this.regionRepository.create(region);
  } 

  /**
   * Save region entity to the db
   * @param region_entity 
   * @returns 
   */
  async save(region_entity: Region) {
    return this.regionRepository.save(region_entity);
  }

  /**
   * Save array of region entities to the db
   * @param region_entities 
   * @returns 
   */
  async save_array(region_entities: Region[]) {
    return this.regionRepository.save(region_entities);
  }

  /**
   * Updates region
   * updates years, based on region_id or region_code
   * 
   * @param db_region_id 
   * @param db_region_years 
   * @param db_region_code
   * @returns 
   */
  async update(
    db_region_id: number | undefined, 
    db_region_years: number[] | undefined | null,
    db_region_code?: string | undefined, 
  ) {
 
    if (db_region_years === undefined) {
      db_region_years = null;
    } else {
      if (db_region_years !== null) {
        if (db_region_years.length == 0) {
          db_region_years = null;
        }
      }
    }

    let query = this.regionRepository
      .createQueryBuilder()
      .update()
      .set({
        years: db_region_years, // cant set the array. invalid input syntax for type smallint: "{"2022"}"
      });

    if (db_region_id != undefined) {
      query.where("id = :id", { id: db_region_id });
    } else if (db_region_code != undefined) {
      query.where("code = :code", {code: db_region_code});
    } else {
      throw new HttpException("Can only update region if id or code is provided", HttpStatus.INTERNAL_SERVER_ERROR);
    }
    // console.log(query.getQuery());
    return query.execute();
  }

  /**
   * Updates region
   * Optionally updates country if found required
   * 
   * if country data is provided, try to check if all other regions have **year** 
   * cached and if they do, remove year from all regions and update country with 
   * that year set as cached
   * 
   * @param db_region region entity class
   * @param year
   * @param db_country_id @param db_country_regions @param db_country_years
   */
  async add_year(
    db_region: Region, 
    year: number, 
    db_country_id?: number, 
    db_country_regions?: Region[], 
    db_country_years?: number[]
  ) {
    if (db_country_id != undefined && db_country_regions != undefined) {
      let do_remove = false;
      let new_years_for_regions = [];
      // do additional check to see if can remove years from all other regions and add it to year instead.
      if (db_country_regions.length != 0) {
        for (let i=0; i<db_country_regions.length; i++) {
          new_years_for_regions.push([]);
          if (db_country_regions[i].id != db_region.id) {
            if (db_country_regions[i].years != null) {
              let inner_change = false;
              for (let j=0; j<db_country_regions[i].years.length; j++) {
                if (db_country_regions[i].years[j] == year) {
                  do_remove = true;
                  inner_change = true;
                  break;
                } else {
                  new_years_for_regions[i] = db_country_regions[i].years[j];
                }
              }
              if (!inner_change) {
                do_remove = false;
              }
            } else {
              do_remove = false;
            }
          }
        }
        if (do_remove) {
          for (let i=0; i<db_country_regions.length; i++) {
            if (db_country_regions[i].id != db_region.id) {
              // country_entity.regions[i].years = (new_years_for_regions[i].length == 0) ? null : new_years_for_regions[i];
              await this.update(db_region.id, new_years_for_regions[i], db_region.code)
            }
          }
          await this.countryEntityService.add_year(db_country_id, db_country_years, year);
        } else {

          await this.update(db_region.id, db_region.years, db_region.code);
        }


      } else {
        await this.update(db_region.id, db_region.years, db_region.code);
      }


    } else {
      await this.update(db_region.id, db_region.years, db_region.code);
    }
  }
}

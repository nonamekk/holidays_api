import { Injectable, Inject, HttpException, HttpStatus, forwardRef } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Country } from '../country/country.entity';
import { CountryEntityService } from '../country/country.service';
import { Region } from './region.entity';
import { IRegionEntity } from './region.interface';

@Injectable()
export class RegionEntityService {
  constructor(
    @Inject('REGION_REPOSITORY')
    private regionRepository: Repository<Region>,
    @Inject(forwardRef(() => CountryEntityService))
    private readonly countryEntityService: CountryEntityService
  ) {}


  async find_by_country(country_id: number) {
    return this.regionRepository.find({
      where: {
        countryId: country_id 
      }
    })
  }



  create(region_code: string, country: Country) {
    const region = new Region();
    region.code = region_code;
    region.country = country;
    return this.regionRepository.create(region);
  } 

  async save(region: Region) {
    return this.regionRepository.save(region);
  }

  async save_array(regions: Region[]) {
    return this.regionRepository.save(regions);
  }

  // better use just input, without interface, if interface will not be required, 
  // change to key: value
  /**
   * Updates region
   * updates years, based on country_id, region_id or region_code
   * 
   * > better use just input, without interface, if interface will not be required
   * @param region_id 
   * @param region_code
   * @param region_years 
   * @returns 
   */
  async update(
    region_id: number, 
    region_years: number[] | undefined | null,
    region_code?: string | undefined, 
    // country_id?: number | undefined
  ) {
 
    if (region_years === undefined) {
      region_years = null;
    } else {
      if (region_years !== null) {
        if (region_years.length == 0) {
          region_years = null;
        }
      }
    }

    let query = this.regionRepository
      .createQueryBuilder()
      .update()
      .set({
        years: region_years, // cant set the array. invalid input syntax for type smallint: "{"2022"}"
      });

    // // allows to update all regions of country with same years, but it is risky as regions might be different
    // if (country_id != undefined) {
    //   query.where("countryId = :country_id", {country_id: country_id});
    // } else
    if (region_id != undefined) {
      query.where("id = :id", { id: region_id });
    } else if (region_code != undefined) {
      query.where("code = :code", {code: region_code});
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
   * @param region region entity class
   * @param year 
   * @param country_entity if provided, try to check if all other regions have @param year cached and if they do, 
   * remove year from all regions and update country with that year set as cached
   */
  async add_year(region: Region, year: number, country_entity?: Country) {
    if (country_entity != undefined) {
      let do_remove = false;
      let new_years_for_regions = [];
      // do additional check to see if can remove years from all other regions and add it to year instead.
      if (country_entity.regions.length != 0) {
        for (let i=0; i<country_entity.regions.length; i++) {
          new_years_for_regions.push([]);
          if (country_entity.regions[i].id != region.id) {
            if (country_entity.regions[i].years != null) {
              let inner_change = false;
              for (let j=0; j<country_entity.regions[i].years.length; j++) {
                if (country_entity.regions[i].years[j] == year) {
                  do_remove = true;
                  inner_change = true;
                  break;
                } else {
                  new_years_for_regions[i] = country_entity.regions[i].years[j];
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
          for (let i=0; i<country_entity.regions.length; i++) {
            if (country_entity.regions[i].id != region.id) {
              // country_entity.regions[i].years = (new_years_for_regions[i].length == 0) ? null : new_years_for_regions[i];
              await this.update(region.id, new_years_for_regions[i], region.code)
            }
          }
          await this.countryEntityService.add_year(country_entity.id, country_entity.years, year);
        } else {

          await this.update(region.id, region.years, region.code);
        }


      } else {
        await this.update(region.id, region.years, region.code);
      }


    } else {
      await this.update(region.id, region.years, region.code);
    }
  }
}

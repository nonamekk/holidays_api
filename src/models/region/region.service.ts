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
  async update(region: IRegionEntity) {
   let region_years = null;
   if (region.years != null) {
     if (region.years != undefined) {
      if (region.years.length > 0) {
        region_years = region.years
      }
     }
   }
    let query = this.regionRepository
      .createQueryBuilder()
      .update()
      .set({
        years: region_years, // cant set the array. invalid input syntax for type smallint: "{"2022"}"
      });

    if (region.country_id != undefined) {
      query.where("countryId = :country_id", {country_id: region.country_id});
    } else
      if (region.id != undefined) {
      query.where("id = :id", { id: region.id });
    } else if (region.code != undefined) {
      query.where("code = :code", {code: region.code});
    } else {
      throw new HttpException("Can only update region if id or code is provided", HttpStatus.INTERNAL_SERVER_ERROR);
    }
    console.log(query.getQuery());
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
              await this.update({"id": region.id, "code": region.code, "years": new_years_for_regions[i]})
            }
          }
          await this.countryEntityService.add_year(country_entity, year);
        } else {

          await this.update({"id": region.id, "code": region.code, "years": region.years});
        }


      } else {
        await this.update({"id": region.id, "code": region.code, "years": region.years});
      }


    } else {
      await this.update({"id": region.id, "code": region.code, "years": region.years});
    }
  }
}

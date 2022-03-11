import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Country } from '../country/country.entity';
import { Region } from './region.entity';
import { IRegionEntity } from './region.interface';

@Injectable()
export class RegionEntityService {
  constructor(
    @Inject('REGION_REPOSITORY')
    private regionRepository: Repository<Region>,
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
}


import { Module } from '@nestjs/common';
import { ListingModule } from 'src/utilities/listing.module';
import { DatabaseModule } from '../../database/database.module';
import { RegionEntityModule } from '../region/region.module';
import { countryProviders } from './country.providers';
import { CountryEntityService } from './country.service';

@Module({
  imports: [DatabaseModule, RegionEntityModule, ListingModule],
  providers: [
    ...countryProviders, 
    CountryEntityService,
  ],
  exports: [
    CountryEntityService
  ]
})
export class CountryEntityModule {}

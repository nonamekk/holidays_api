
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RegionEntityModule } from '../region/region.module';
import { countryProviders } from './country.providers';
import { CountryService } from './country.service';

@Module({
  imports: [DatabaseModule, RegionEntityModule],
  providers: [
    ...countryProviders, 
    CountryService,
  ],
  exports: [
    CountryService
  ]
})
export class CountryModule {}

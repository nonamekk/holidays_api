import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CountryEntityModule } from '../country/country.module';
import { CountryEntityService } from '../country/country.service';
import { regionEntityProviders } from './region.providers';
import { RegionEntityService } from './region.service';


@Module({
  imports: [DatabaseModule, forwardRef(() => CountryEntityModule)],
  providers: [
    ...regionEntityProviders,
    RegionEntityService,
  ],
  exports: [
    RegionEntityService,
    ...regionEntityProviders
  ]
})
export class RegionEntityModule {}

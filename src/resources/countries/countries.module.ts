import { Module } from '@nestjs/common';

import { CountriesListController } from './countries.controller';
import { CountriesService } from './countries.service';
import { CallendarModule } from 'src/integrations/holiday_callendar_api/callendar.module';
import { CountryEntityModule } from 'src/models/country/country.module';
import { OnSyncModule } from 'src/utilities/onsync.module';

@Module({
  imports: [CallendarModule, CountryEntityModule, OnSyncModule],
  controllers: [CountriesListController],
  providers: [CountriesService],
  exports: [CountriesService]
})
export class CountriesListModule {}

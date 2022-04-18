import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DayEntityService } from './day.service';
import { dayEntityProviders } from './day.providers';
import { CountryEntityModule } from '../country/country.module';
import { RegionEntityModule } from '../region/region.module';
import { MonthDaysArrayModule } from 'src/utilities/month_days_array/mda.module';


@Module({
  imports: [
    DatabaseModule,
    RegionEntityModule, CountryEntityModule,
    MonthDaysArrayModule
  ],
  providers: [
    ...dayEntityProviders,
    DayEntityService,
  ],
  exports: [
    DayEntityService
  ]
})
export class DayEntityModule {}

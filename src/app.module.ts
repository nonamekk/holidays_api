import { Module } from '@nestjs/common';
import { CountriesListModule } from './resources/countries/countries.module';
import { FreeDaysResourceModule } from './resources/free_days/freed.module';
import { HolidaysResourceModule } from './resources/holidays/holidays.module';
import { StatusOfDayResourceModule } from './resources/status/status.module';

@Module({
  imports: [CountriesListModule, HolidaysResourceModule, StatusOfDayResourceModule, FreeDaysResourceModule],
  controllers: [],
  providers: []
})
export class AppModule {}

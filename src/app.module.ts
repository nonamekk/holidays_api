import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { CountriesListModule } from './resources/countries/countries.module';
import { HolidaysResourceModule } from './resources/holidays/holidays.module';
import { StatusOfDayResourceModule } from './resources/status/status.module';

@Module({
  imports: [CountriesListModule, HolidaysResourceModule, StatusOfDayResourceModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}

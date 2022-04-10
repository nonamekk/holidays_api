import { Module } from '@nestjs/common';

import { CallendarModule } from 'src/integrations/holiday_callendar_api/callendar.module';
import { HolidaysResourceController } from './holidays.controller';
import { HolidaysResourceService } from './holidays.service';
import { DayEntityModule } from 'src/models/day/day.module';
import { CacherModule } from 'src/cacher/casher.module';
import { CallendarPrepareModule } from 'src/integrations/holiday_callendar_api/data_prepare/prepdays.module';
import { DateLimitsThrowingModule } from 'src/utilities/throwers/date_limits/date_limits.module';
import { StatusOfDayResourceModule } from '../status/status.module';
import { CountryEntityModule } from 'src/models/country/country.module';

@Module({
  imports: [CallendarModule, DayEntityModule, CountryEntityModule,
    CacherModule, CallendarPrepareModule, DateLimitsThrowingModule,
    StatusOfDayResourceModule],
  controllers: [HolidaysResourceController],
  providers: [HolidaysResourceService],
  exports: [HolidaysResourceService]
})
export class HolidaysResourceModule {}

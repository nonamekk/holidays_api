import { Module } from '@nestjs/common';

import { CallendarModule } from 'src/integrations/holiday_callendar_api/callendar.module';
import { CountryEntityModule } from 'src/models/country/country.module';
import { RegionEntityModule } from 'src/models/region/region.module';
import { DayEntityModule } from 'src/models/day/day.module';
import { MonthDaysArrayModule } from 'src/utilities//month_days_array/mda.module';
import { CacherModule } from 'src/cacher/casher.module';
import { StatusOfDayResourceController } from './status.controller';
import { StatusOfDayResourceService } from './status.service';
import { DaysInMonthsModule } from 'src/utilities/dim.module';
import { CallendarPrepareModule } from 'src/integrations/holiday_callendar_api/data_prepare/prepdays.module';
import { DateLimitsThrowingModule } from 'src/utilities/throwers/date_limits/date_limits.module';

@Module({
  imports: [CallendarModule, CountryEntityModule, DayEntityModule, MonthDaysArrayModule, 
    CacherModule, RegionEntityModule, DaysInMonthsModule,
    CallendarPrepareModule, DateLimitsThrowingModule],
  controllers: [StatusOfDayResourceController],
  providers: [StatusOfDayResourceService],
  exports: [StatusOfDayResourceService]
})
export class StatusOfDayResourceModule {}

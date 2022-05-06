import { Module } from '@nestjs/common';
import { CountryEntityModule } from 'src/models/country/country.module';
import { RegionEntityModule } from 'src/models/region/region.module';

import { FreeDaysResourceController } from './freed.controller';
import { FreeDaysResourceService } from './freed.service';
import { DayEntityModule } from 'src/models/day/day.module';
import { CacherModule } from 'src/cacher/casher.module';
import { DaysInMonthsModule } from 'src/utilities/dim.module';
import { StatusOfDayResourceModule } from '../status/status.module';
import { CallendarPrepareModule } from 'src/integrations/holiday_callendar_api/data_prepare/prepdays.module';
import { DateLimitsThrowingModule } from 'src/utilities/throwers/date_limits/date_limits.module';
import { HolidaysResourceModule } from '../holidays/holidays.module';
import { ListingModule } from 'src/utilities/listing.module';

@Module({
  imports: [ DayEntityModule, RegionEntityModule, CountryEntityModule,
    CacherModule, DaysInMonthsModule, HolidaysResourceModule,
    StatusOfDayResourceModule, CacherModule,
    CallendarPrepareModule, DateLimitsThrowingModule,
    ListingModule
],
  controllers: [FreeDaysResourceController],
  providers: [FreeDaysResourceService],
  exports: [FreeDaysResourceService]
})
export class FreeDaysResourceModule {}

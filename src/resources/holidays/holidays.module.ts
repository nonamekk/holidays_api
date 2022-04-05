import { Module } from '@nestjs/common';

import { CallendarModule } from 'src/integrations/holiday_callendar_api/callendar.module';
import { CountryEntityModule } from 'src/models/country/country.module';
import { RegionEntityModule } from 'src/models/region/region.module';
import { HolidaysResourceController } from './holidays.controller';
import { HolidaysResourceService } from './holidays.service';
import { DayEntityModule } from 'src/models/day/day.module';
import { DescriptorModule } from 'src/utilities/descriptor.module';
import { ConfigModule } from 'src/config/config.module';
import { CacherModule } from 'src/cacher/casher.module';
import { CallendarPrepareModule } from 'src/integrations/holiday_callendar_api/data_prepare/prepdays.module';
import { DateLimitsThrowingModule } from 'src/utilities/throwers/date_limits/date_limits.module';
import { StatusOfDayResourceModule } from '../status/status.module';

@Module({
  imports: [CallendarModule, CountryEntityModule, DayEntityModule, DescriptorModule, ConfigModule, 
    CacherModule, RegionEntityModule, CallendarPrepareModule, DateLimitsThrowingModule,
    StatusOfDayResourceModule],
  controllers: [HolidaysResourceController],
  providers: [HolidaysResourceService],
  exports: [HolidaysResourceService]
})
export class HolidaysResourceModule {}

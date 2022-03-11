import { Module } from '@nestjs/common';

import { CallendarModule } from 'src/integrations/holiday_callendar_api/callendar.module';
import { CountryModule } from 'src/models/country/country.module';
import { RegionEntityModule } from 'src/models/region/region.module';
import { HolidaysResourceController } from './holidays.controller';
import { HolidaysResourceService } from './holidays.service';
import { DayEntityModule } from 'src/models/day/day.module';
import { DescriptorModule } from 'src/utilities/descriptor.module';
import { ConfigModule } from 'src/config/config.module';
import { CacherModule } from 'src/cacher/casher.module';

@Module({
  imports: [CallendarModule, CountryModule, DayEntityModule, DescriptorModule, ConfigModule, 
    CacherModule, RegionEntityModule],
  controllers: [HolidaysResourceController],
  providers: [HolidaysResourceService],
  exports: [HolidaysResourceService]
})
export class HolidaysResourceModule {}

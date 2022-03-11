import { Module } from '@nestjs/common';
import { CallendarModule } from 'src/integrations/holiday_callendar_api/callendar.module';
import { CountryModule } from 'src/models/country/country.module';
import { DayEntityModule } from 'src/models/day/day.module';
import { RegionEntityModule } from 'src/models/region/region.module';
import { CacherService } from './cacher.service';

@Module({
  imports: [CallendarModule, RegionEntityModule, CountryModule, DayEntityModule],
  providers: [CacherService],
  exports: [CacherService],
})
export class CacherModule {}

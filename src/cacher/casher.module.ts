import { Module } from '@nestjs/common';
import { CallendarModule } from 'src/integrations/holiday_callendar_api/callendar.module';
import { CountryEntityModule } from 'src/models/country/country.module';
import { DayEntityModule } from 'src/models/day/day.module';
import { RegionEntityModule } from 'src/models/region/region.module';
import { ListingModule } from 'src/utilities/listing.module';
import { CacherService } from './cacher.service';

@Module({
  imports: [CallendarModule, RegionEntityModule, CountryEntityModule, DayEntityModule,
  ListingModule],
  providers: [CacherService],
  exports: [CacherService],
})
export class CacherModule {}

import { Module } from '@nestjs/common';

import { CallendarModule } from 'src/integrations/holiday_callendar_api/callendar.module';
import { CountryEntityModule } from 'src/models/country/country.module';
// import { OnSyncModule } from 'src/utilities/onsync.module';
import { RegionEntityModule } from 'src/models/region/region.module';
import { DayEntityModule } from 'src/models/day/day.module';
// import { ErrorService } from 'src/errors/adderror.service';
import { DescriptorModule } from 'src/utilities/descriptor.module';
import { ConfigModule } from 'src/config/config.module';
import { CacherModule } from 'src/cacher/casher.module';
import { StatusOfDayResourceController } from './status.controller';
import { StatusOfDayResourceService } from './status.service';

@Module({
  imports: [CallendarModule, CountryEntityModule, DayEntityModule, DescriptorModule, ConfigModule, 
    CacherModule, RegionEntityModule],
  controllers: [StatusOfDayResourceController],
  providers: [StatusOfDayResourceService],
  exports: [StatusOfDayResourceService]
})
export class StatusOfDayResourceModule {}

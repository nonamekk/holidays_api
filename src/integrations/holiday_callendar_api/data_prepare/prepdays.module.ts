import { Module } from '@nestjs/common';
import { CallendarPrepareService } from './prepdays.service';
import { CallendarModule } from '../callendar.module';
import { ConfigModule } from 'src/config/config.module';
import { DateLimitsThrowingModule } from 'src/utilities/throwers/date_limits/date_limits.module';
import { CountryEntityModule } from 'src/models/country/country.module';
import { DayEntityModule } from 'src/models/day/day.module';
import { ListingModule } from 'src/utilities/listing.module';



@Module({
    imports: [CallendarModule, ConfigModule, DateLimitsThrowingModule,
      CallendarModule, CountryEntityModule, DayEntityModule,
      ListingModule
    ],
    providers: [CallendarPrepareService],
    exports: [CallendarPrepareService]
  })
  export class CallendarPrepareModule {}
  
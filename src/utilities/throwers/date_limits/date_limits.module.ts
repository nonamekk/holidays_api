import { Module } from '@nestjs/common';
import { DateLimitsThrowingService } from './date_limits.service';

@Module({
    imports: [],
    providers: [DateLimitsThrowingService],
    exports: [DateLimitsThrowingService]
  })
  export class DateLimitsThrowingModule {}
  
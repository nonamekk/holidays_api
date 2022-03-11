import { Module } from '@nestjs/common';
import { ErrorService } from './adderror.service';

@Module({
  providers: [ErrorService],
  exports: [ErrorService],
})
export class ErrorModule {}

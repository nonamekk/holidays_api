import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CallendarService } from './callendar.service';



@Module({
    imports: [HttpModule],
    providers: [CallendarService],
    exports: [CallendarService]
  })
  export class CallendarModule {}
  
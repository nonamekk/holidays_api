import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DayEntityService } from './day.service';
import { dayEntityProviders } from './day.providers';
import { DescriptorModule } from 'src/utilities/descriptor.module';


@Module({
  imports: [DatabaseModule, DescriptorModule],
  providers: [
    ...dayEntityProviders,
    DayEntityService,
  ],
  exports: [
    DayEntityService
  ]
})
export class DayEntityModule {}

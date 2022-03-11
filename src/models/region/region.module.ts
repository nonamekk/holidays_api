import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { regionEntityProviders } from './region.providers';
import { RegionEntityService } from './region.service';


@Module({
  imports: [DatabaseModule],
  providers: [
    ...regionEntityProviders,
    RegionEntityService,
  ],
  exports: [
    RegionEntityService,
    ...regionEntityProviders
  ]
})
export class RegionEntityModule {}

import { Module } from "@nestjs/common";
import { ConfigModule } from "src/config/config.module";
import { OnSyncService } from "./onsync.service";

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [OnSyncService],
  exports: [OnSyncService]
})
export class OnSyncModule {}

import { CacheModule, Module } from "@nestjs/common";
import { ConfigService } from "./config.service";

@Module({
  imports: [CacheModule.register()],
  controllers: [],
  providers: [ConfigService],
  exports: [ConfigService]
})
export class ConfigModule {}

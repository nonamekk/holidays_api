import { CacheModule, Module } from "@nestjs/common";
import { MonthDaysArrayService } from "./mda.service";

@Module({
  imports: [CacheModule.register()],
  controllers: [],
  providers: [MonthDaysArrayService],
  exports: [MonthDaysArrayService]
})
export class MonthDaysArrayModule {}

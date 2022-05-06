import { Module } from "@nestjs/common";
import { MonthDaysArrayService } from "./mda.service";

@Module({
    imports: [],
    controllers: [],
    providers: [MonthDaysArrayService],
    exports: [MonthDaysArrayService]
  })
  export class MonthDaysArrayModule {}
  
import { Module } from "@nestjs/common";
import { DayEntityModule } from "src/models/day/day.module";
import { DaysInMonthsService } from "./dim.service";

@Module({
  imports: [DayEntityModule],
  controllers: [],
  providers: [DaysInMonthsService],
  exports: [DaysInMonthsService]
})
export class DaysInMonthsModule {}

import { Module } from "@nestjs/common";
import { ListingService } from "./listing.service";

@Module({
  imports: [],
  controllers: [],
  providers: [ListingService],
  exports: [ListingService]
})
export class ListingModule {}

import { Body, Controller, Get, Header, HttpCode, HttpException, HttpStatus, Post, Query } from "@nestjs/common";
import { StatusDtoRequest } from "./status.dto";
import { StatusOfDayResourceService } from "./status.service";

@Controller('status')
export class StatusOfDayResourceController {
    constructor(
        private readonly statusOfDayService: StatusOfDayResourceService,
    ) {}

    @Get()
    async getHolidaysList(
        @Query() req: StatusDtoRequest
    ) {
        return this.statusOfDayService.validateRequest(req);
    }
}
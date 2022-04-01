import { Controller, Get, Header, HttpCode, HttpException, HttpStatus, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { HolidaysDtoRequest } from "../holidays/holidays.dto";
import { HolidaysResourceService } from "../holidays/holidays.service";
import { StatusOfDayResourceService } from "../status/status.service";
import { FreeDaysResourceService } from "./freed.service";

@Controller('freedays')
export class FreeDaysResourceController {
    constructor(
        private readonly freeDaysResourceService: FreeDaysResourceService,
        private readonly holidaysResourceService: HolidaysResourceService
    ) {}

    
    @Get()
    async getFreeDays(
        @Query() req: HolidaysDtoRequest
    ) {
        return await this.freeDaysResourceService.prepareMaxFoundDaysInRow(
            this.holidaysResourceService.validateRequest(req)
        );
    }
}
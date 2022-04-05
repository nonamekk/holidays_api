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
    @ApiOperation({
        description: "This endpoint returns date and its status, which can be freeday, workday or holiday"
    })
    @ApiResponse({
        status: 200,
        description: "Extends on day date providing additional data, provides day status",
        schema: {
            type: "object",
            example: {
                "date": {
                    "day": 12,
                    "month": 1,
                    "year": 2019,
                    "week_day_number": 6,
                    "week_day": "Saturday",
                    "to_date": "2019-01-12T00:00:00.000Z"
                },
                "status": "freeday"
            }
        }
    })
    @ApiResponse({
        status: 400,
        description: "Bad Request - validation not passing, country not found by name or error from enrico Service"
    })
    @ApiQuery({
        name: "day",
        description: "Day number. Usually 1-31, but depends on given year and month",
        required: true,
        example: 12
    })
    @ApiQuery({
        name: "month",
        description: "Month number. 1-12",
        required: true,
        example: 1
    })
    @ApiQuery({
        name: "year",
        description: "Year number. Accepts only unsigned smallint",
        required: true,
        example: 2019
    })
    @ApiQuery({
        name: "country_name",
        description: "Name of the country, case insensitive (2-32 characters)",
        required: false,
        example: "Australia"
    })
    @ApiQuery({
        name: "country_code",
        description: "Country code (3 letters), case insensitive, has priority over country_name",
        example: "aus",
        required: false,
    })
    @ApiQuery({
        name: "region_code",
        description: "Region code (2-3 letters), case insensitive",
        example: "act",
        required: false,
    })
    async getFreeDays(
        @Query() req: HolidaysDtoRequest
    ) {
        return await this.freeDaysResourceService.prepareMaxFoundDaysInRow(
            this.holidaysResourceService.validateRequest(req)
        );
    }
}
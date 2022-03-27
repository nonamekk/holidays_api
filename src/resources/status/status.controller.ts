import { Controller, Get, Header, HttpCode, HttpException, HttpStatus, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { StatusDtoRequest } from "./status.dto";
import { StatusOfDayResourceService } from "./status.service";

@Controller('status')
export class StatusOfDayResourceController {
    constructor(
        private readonly statusOfDayService: StatusOfDayResourceService,
    ) {}

    @Get()
    @ApiOperation({
        description: "This endpoint returns information about the requested day. \n\nIt provides information about day status (workday, holiday or freeday) and requested date"
    })
    @ApiResponse({
        status: 200,
        description: 'Returns day info, caches the result to the database',
        schema: {
            type: "object",
            example: {
                "date": {
                    "day": 1,
                    "month": 1,
                    "year": 2019,
                    "week_day_number": 2,
                    "week_day": "Tueday",
                    "to_date": "2019-01-01T00:00:00.000Z"
                },
                "status": "holiday"
            }
        }
    })
    @ApiQuery({
        name: "day",
        description: "Day number. Usually 1-31, but depends on given year and month",
        required: true,
        example: 1
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
        example: "Germany"
    })
    @ApiQuery({
        name: "country_code",
        description: "Country code (3 letters), case insensitive, has priority over country_name",
        example: "deu",
        required: false,
    })
    @ApiQuery({
        name: "region_code",
        description: "Region code (2 letters), case insensitive",
        example: "be",
        required: false,
    })
    @ApiResponse({
        status: 400,
        description: 'Bad Request - coould not pass validation or error from third-party API'
    })
    @ApiResponse({
        status: 500,
        description: 'Internal Server Error'
    })
    async getHolidaysList(
        @Query() req: StatusDtoRequest
    ) {
        return await this.statusOfDayService.serveDayStatus(
            this.statusOfDayService.validateRequest(req)
        );
    }
}
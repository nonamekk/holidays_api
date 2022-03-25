import { Body, Controller, Get, Header, HttpCode, HttpException, HttpStatus, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";
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
                    "year": 2012,
                    "day_of_week": 1,
                    "utc": 31
                },
                "status": "holiday"
            }
        }
    })
    @ApiResponse({
        status: 400,
        description: 'Bad Request - coould not pass validation or error from third-party API'
    })
    async getHolidaysList(
        @Query() req: StatusDtoRequest
    ) {
        return await this.statusOfDayService.serveDayStatus(
            this.statusOfDayService.validateRequest(req)
        );
    }
}
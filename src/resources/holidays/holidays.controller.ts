import { Controller,Get, Query } from "@nestjs/common";
import { HolidaysDtoRequest } from "./holidays.dto";
import { HolidaysResourceService } from "./holidays.service";

import { ApiOperation, ApiResponse, ApiQuery } from "@nestjs/swagger";


@Controller('holidays')
export class HolidaysResourceController {
    constructor(
        private readonly holidaysResourceService: HolidaysResourceService,
    ) {}

    @Get()
    @ApiOperation({
        description: "This endpoint returns list of months with holidays days. \n\nIt is required to provide at least either country_name or country_code, because the response returns holidays for the country specified. \n\nThe results are cached to the database. \nThere's a setting to turn on/off hotload, which makes request to the API prior finding data in the database, so in the case of not finding data in the database, serve serialized data from the third-party API"
    })
    @ApiResponse({
        status: 200,
        description: 'Groups each holiday day to a month for set country and year',
        schema: {
            type: "array",
            example: [
                {
                    "id": 0,
                    "month": "January",
                    "days": [
                        {
                            "year": 2022,
                            "month": 1,
                            "day": 1,
                            "dayOfWeek": 7
                        }
                    ]
                },
                {
                    "id": 1,
                    "month": "February",
                    "days": []
                },
                {
                    "id": 2,
                    "month": "March",
                    "days": []
                },
                {
                    "id": 3,
                    "month": "April",
                    "days": [
                        {
                            "year": 2022,
                            "month": 4,
                            "day": 15,
                            "dayOfWeek": 6
                        }
                    ]
                },
                {
                    "id": 4,
                    "month": "May",
                    "days": [
                        {
                            "year": 2022,
                            "month": 5,
                            "day": 2,
                            "dayOfWeek": 2
                        }
                    ]
                },
                {
                    "id": 5,
                    "month": "June",
                    "days": []
                },
                {
                    "id": 6,
                    "month": "July",
                    "days": []
                },
                {
                    "id": 7,
                    "month": "August",
                    "days": [
                        {
                            "year": 2022,
                            "month": 8,
                            "day": 1,
                            "dayOfWeek": 2
                        }
                    ]
                },
                {
                    "id": 8,
                    "month": "September",
                    "days": []
                },
                {
                    "id": 9,
                    "month": "October",
                    "days": [
                        {
                            "year": 2022,
                            "month": 10,
                            "day": 3,
                            "dayOfWeek": 2
                        }
                    ]
                },
                {
                    "id": 10,
                    "month": "November",
                    "days": []
                },
                {
                    "id": 11,
                    "month": "December",
                    "days": [
                        {
                            "year": 2022,
                            "month": 12,
                            "day": 25,
                            "dayOfWeek": 1
                        }
                    ]
                }
            ]
        }
    })
    @ApiResponse({
        status: 400,
        description: 'Bad Request - could not pass validation'
    })
    @ApiResponse({
        status: 404,
        description: 'Requested country/region not found'
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
        example: "nt",
        required: false
    })
    @ApiQuery({
        name: "year",
        description: "Year of interest",
        required: true,
        example: 2022,
    })
    async getHolidaysList(
        @Query() req: HolidaysDtoRequest
    ) {
        return await this.holidaysResourceService.serveHolidaysList(
            this.holidaysResourceService.validateRequest(req)
        );
    }
}
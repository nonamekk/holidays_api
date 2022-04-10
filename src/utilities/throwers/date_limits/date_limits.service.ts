import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ISimpleDate } from "src/models/country/country.interface";

@Injectable()
export class DateLimitsThrowingService {
    constructor() {}

    /**
     * Tries to throw if date limit bounds are exceeded with requested date
     * 
     * @param starting_date from the database or response
     * @param ending_date from teh database or response
     * @param requested_date from request
     * @throws HttpException with dates before or after that are not supported
     */
    tryThrowDatesLimits(starting_date: ISimpleDate, ending_date: ISimpleDate, requested_date: ISimpleDate) {
        if (starting_date.year > requested_date.year) {
            this.throwBeforeError(starting_date);

        } else if (starting_date.year == requested_date.year) {
            if (starting_date.month > requested_date.month) {
                this.throwBeforeError(starting_date)
            } else if (starting_date.month == requested_date.month) {
                if (starting_date.day > requested_date.day) {
                    this.throwBeforeError(starting_date);
                }
            }

        } else if (ending_date.year < requested_date.year) {
            this.throwAfterError(ending_date);
        } else if (ending_date.year == requested_date.year) {
            
            if (ending_date.month < requested_date.month) {
                this.throwBeforeError(ending_date)
            } else if (ending_date.month == requested_date.month) {
                if (ending_date.day < requested_date.day) {
                    this.throwBeforeError(ending_date);
                }
            }
        }
    }

    /**
     * Prepares dates before throw
     * @param starting_date 
     * @throws HttpException
     */
    throwBeforeError(starting_date: ISimpleDate) {
        throw new HttpException({ 
            "code": 400, 
            "error": {
                date: {
                    year: starting_date.year,
                    month: starting_date.month,
                    day: starting_date.day
                }
            },
            "message": "Dates before are not supported"
        }, HttpStatus.BAD_REQUEST);
    }

    /**
     * Prepares dates after throw
     * @param ending_date 
     * @throws HttpException
     */
    throwAfterError(ending_date: ISimpleDate) {
        throw new HttpException({ 
            "code": 400, 
            "error": {
                date: {
                    year: ending_date.year,
                    month: ending_date.month,
                    day: ending_date.day
                }
            },
            "message": "Dates after are not supported"
        }, HttpStatus.BAD_REQUEST);
    }

    /**
     * Throws if requested year if date limit bounds are exceeded with requested date
     * 
     * @param starting_date from database or response
     * @param ending_date from database or response
     * @param requested_year from request
     * @throws HttpException with least or most available year for requested country
     */
     tryThrowYearLimits(starting_date: ISimpleDate, ending_date: ISimpleDate, requested_year: number) {
        if (starting_date.year > requested_year) {
            if (starting_date.month != 1 && starting_date.day != 1) {
                throw new HttpException({ "code": 400, "error": {year: "least available is"+(starting_date.year+1)} }, HttpStatus.BAD_REQUEST);
            } else {
                throw new HttpException({ "code": 400, "error": {year: "least available is"+starting_date.year} }, HttpStatus.BAD_REQUEST);
            }
        } else if (starting_date.year == requested_year) {
            if (starting_date.month != 1 && starting_date.day != 1) {
                throw new HttpException({ "code": 400, "error": {year: "least available is"+(starting_date.year+1)} }, HttpStatus.BAD_REQUEST);
            }
        } else if (ending_date.year < requested_year) {
            if (ending_date.month != 1 && ending_date.day != 1) {
                throw new HttpException({ "code": 400, "error": {year: "most available is"+(ending_date.year-1)} }, HttpStatus.BAD_REQUEST);
            } else {
                throw new HttpException({ "code": 400, "error": {year: "most available is"+(ending_date.year)} }, HttpStatus.BAD_REQUEST);
            }
        } else if (ending_date.year == requested_year) {
            if (ending_date.month != 1 && ending_date.day != 1) {
                throw new HttpException({ "code": 400, "error": {year: "most available is"+(ending_date.year-1)} }, HttpStatus.BAD_REQUEST);
            }
        }
    }

}
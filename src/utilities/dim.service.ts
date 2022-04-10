import { Injectable } from '@nestjs/common';
import { DayEntityService } from 'src/models/day/day.service';

@Injectable()
export class DaysInMonthsService {
    constructor(
        private readonly dayEntityService: DayEntityService,
    ) {}
    
    days_in_months = [
        31, // January
        28, // February
        31, // March
        30, // April
        31, // May
        30, // June
        31, // July
        31, // August
        30, // September
        31, // October
        30, // November
        31, // Decemeber
    ];

    /**
     * Get array of days in each month for requested year
     * 
     * January is 0, December is 11
     * @param year 
     * @returns days in months (dim)
     */
    getDaysAmmountsForYear(year: number) {
        if (this.dayEntityService.daysInYear(year) == 365) {
            return this.days_in_months;
        } else {
            this.days_in_months[1] = 29; // leap year
            return this.days_in_months;
        }
    }

    /**
     * Gets number of days for requested month
     * 
     * @param year 
     * @param month from 1-12
     */
    getDaysAmmountsForYearAndMonth(year: number, month: number) {
        if (month == 2) {
            if (this.dayEntityService.daysInYear(year) == 365) {
                return this.days_in_months[1];
            } else {
                return 29 // leap year
            }
        } else {
            return this.days_in_months[month-1];
        }
    }
    
}

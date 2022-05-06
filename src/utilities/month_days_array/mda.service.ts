import { Injectable } from '@nestjs/common';
import { MonthDays } from './mda.type';

/** Creates empty month days array */
@Injectable()
export class MonthDaysArrayService {
        
    getMonthDaysArray(): MonthDays[] {
        return [
            {
                month: "January",
                days: []
            },
            {
                month: "February",
                days: []
            },
            {
                month: "March",
                days: []
            },
            {
                month: "April",
                days: []
            },
            {
                month: "May",
                days: []
            },
            {
                month: "June",
                days: []
            },
            {
                month: "July",
                days: []
            },
            {
                month: "August",
                days: []
            },
            {
                month: "September",
                days: []
            },
            {
                month: "October",
                days: []
            },
            {
                month: "November",
                days: []
            },
            {
                month: "December",
                days: []
            }
        ];
    }
}
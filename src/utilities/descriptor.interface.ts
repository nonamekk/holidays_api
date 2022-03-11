import { IDate } from '../integrations/holiday_callendar_api/callendar.interface';

export interface IMonthsObject {
    id: number,
    month: string,
    days: IDate[]
}
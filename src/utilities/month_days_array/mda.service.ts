import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager'
import { MonthsEnum } from '../months.enum';
import { MonthDays } from './mda.type';


@Injectable()
export class MonthDaysArrayService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    /**
     * Produces mda of months enum.
     * 
     * Skips enum keys that are numbers, keeps the rest
     * 
     * Array contains month name and empty days array.
     * Starts at January on 0, ends at December on 11
     * 
     * @param enumeration Enumeration object.
     */
     private monthsEnumToMonthDaysArray<T>(enumeration: T): MonthDays[] {
        return (Object.keys(enumeration) as Array<keyof MonthsEnum>)
            // .filter(key => isNaN(Number(key)))
            .filter(key => typeof enumeration[key] === "number")
            .map(key => ({
                month: String(key),
                days: []
            }));
    }
  
    /**
     * Obtains mda consisting of month name and empty days array in each element
     * 
     * Lazily saves under cacheManager and later called from
     * 
     * @returns mda
     */
    async obtainMonthDaysArray(): Promise<MonthDays[]> {
        let mda: MonthDays[] = await this.cacheManager.get('mda');
        if (mda == null) {
            mda = this.monthsEnumToMonthDaysArray(MonthsEnum);
            await this.cacheManager.set('mda', mda);
        }
        return mda;
    }
}

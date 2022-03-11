

import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager'
import { IMonthsObject } from './descriptor.interface';
import { MonthsEnum } from './months.enum';

type Descripted<T> = {
    [K in keyof T]: {
        readonly id: T[K];
        readonly month: string;
        days: []
    }
}[keyof T]

/**
     * Helper to produce an array of enum descriptors.
     * @param enumeration Enumeration object.
     * @param separatorRegex Regex that would catch the separator in your enum key.
     */
function enumToDescriptedArray<T>(enumeration: T, separatorRegex: RegExp = /_/g): Descripted<T>[] {
    return (Object.keys(enumeration) as Array<keyof T>)
        .filter(key => isNaN(Number(key)))
        .filter(key => typeof enumeration[key] === "number" || typeof enumeration[key] === "string")
        .map(key => ({
            id: enumeration[key],
            month: String(key).replace(separatorRegex, ' '),
            days: []
        }));
}

@Injectable()
export class DescriptorService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}
  
    async getMonthsObjectArray(): Promise<IMonthsObject[]> {
        let value: IMonthsObject[] = await this.cacheManager.get('months');
        if (value == null) {
            await this.cacheManager.set('months', enumToDescriptedArray(MonthsEnum));
        } else {
            return value;
        }
        return await this.cacheManager.get('months');
    }
}

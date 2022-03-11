import { CACHE_MANAGER, Inject, Injectable } from "@nestjs/common";
import { Cache } from 'cache-manager';

import config from '../config/configuration';

@Injectable()
export class ConfigService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}
  
    async getConfig(): Promise<Record<string, any>> {
        let value: Record<string, any> = await this.cacheManager.get('config');
        if (value == null) {
            await this.cacheManager.set('config', this.getConfigFromFile());
        } else {
            return value;
        }
        return await this.cacheManager.get('config');
    }

    getConfigFromFile() {
        return config();
    }
}

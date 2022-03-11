import { Injectable } from "@nestjs/common";
// import config from '../config/configuration';
import { ConfigService } from "src/config/config.service";

@Injectable()
export class OnSyncService {
    constructor (
        private readonly configService: ConfigService
    ) {}
    onTryCall() {
        return this.configService.getConfig().then(cfg => {
            if (cfg.settings.try_source_after_success) {
                let currentDate = new Date();
                return this.onSchedule(cfg.settings, currentDate)
            }
            return false;
        })
        
    }

    onDays(settings, dayOfWeek) {
        if (settings.try_source_after_success_on_days != undefined) {
            for (let i=0; i< settings.try_source_after_success_on_days.length; i++) {
                if (settings.try_source_after_success_on_days[i] == dayOfWeek) {
                    return true;
                }
            }
            return false;
        } else return true;
    }

    onMonths(settings, month) {
        if (settings.try_source_after_success_on_months != undefined) {
            for (let i=0; i< settings.try_source_after_success_on_months.length; i++) {
                if (settings.try_source_after_success_on_months[i] == month) {
                    return true;
                }
            }
            return false;
        } else return true;
        
    }

    onYear(settings, year) {
        if (settings.try_source_after_success_on_years != undefined) {
            for (let i=0; i< settings.try_source_after_success_on_years.length; i++) {
                if (settings.try_source_after_success_on_years[i] == year) {
                    return true;
                }
            }
            return false;
        } else return true;
        
    }

    onSchedule(settings, currentDate: Date) {
        let dayOfWeek = currentDate.getDay();
        let month = currentDate.getMonth();
        let year = currentDate.getFullYear();

        let result = false;
        // Decision is explicit, meaning years have priority over months and so on.
        if (this.onDays(settings, dayOfWeek)) {
            result = true;
            if (this.onMonths(settings, month)) {
                result = true;
                if (this.onYear(settings, year)) {
                    result = true;
                }
            }
        }
        return result;
    }
}
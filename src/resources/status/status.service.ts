import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
// import { map, Observable, tap } from 'rxjs';
// import { ICountry } from 'src/integrations/holiday_callendar_api/callendar.interface';
import { CallendarService } from 'src/integrations/holiday_callendar_api/callendar.service';
// import { Country } from 'src/models/country/country.entity';
import { CountryService } from 'src/models/country/country.service';
// import { Region } from 'src/models/region/region.entity';
import { RegionEntityService } from 'src/models/region/region.service';
// import { OnSyncService } from 'src/utilities/onsync.service';
import { StatusDtoRequest } from './status.dto';
import { IStatusOfDayRequestError } from './status.interface';
import { ErrorService as es } from "src/errors/adderror.service";
import { DayEntityService } from 'src/models/day/day.service';
import { ConfigService } from 'src/config/config.service';
import { lastValueFrom } from 'rxjs';


@Injectable()
export class StatusOfDayResourceService {
    constructor(
        private readonly dayEntityService: DayEntityService,
        private readonly configService: ConfigService,
        private readonly callendarService: CallendarService
    ) {}

    validateRequest(req: StatusDtoRequest) {
        let e: IStatusOfDayRequestError = new Object();

        if (req.country_code == undefined && req.country_name == undefined) {
            e.country_name = es.addError(e.country_name, "required or use country_code");
            e.country_code = es.addError(e.country_code, "required or use country_name");
        }

        if (req.year == undefined) {
            e.year = es.addError(e.year, "required");
        }
        if (req.month == undefined) {
            e.month = es.addError(e.month, "required");
        }
        if (req.day == undefined) {
            e.day = es.addError(e.day, "required");
        }

        if (Object.entries(e).length !== 0) {
            throw new HttpException({"code": 400, "message": e, "error": "Bad Request"}, HttpStatus.BAD_REQUEST)
        }

        if (req.country_code != undefined) {
            if (req.country_code.length != 3) {
                e.country_code = es.addError(e.country_code, "can only be 3 characters long")
            }
            if (/[^a-zA-Z]/.test(req.country_code)) {
                e.country_code = es.addError(e.country_code, "can only be characters")
            }
        }
        if (req.region_code != undefined) {
            if (req.region_code.length != 2 && req.region_code.length != 3) {
                e.region_code = es.addError(e.region_code, "can only be 2-3 characters long")
            }
            if (/[^a-zA-Z ]/.test(req.region_code)) {
                e.region_code = es.addError(e.region_code, "can only be characters")
            }
        }
        if (req.country_name != undefined) {
            if (!(req.country_name.length > 2 && req.country_name.length < 32)) {
                e.country_name = es.addError(e.country_name, "can only be 2-32 characters long")
            }
            if (/[^a-zA-Z]/.test(req.country_name)) {
                e.country_name = es.addError(e.country_name, "can only be characters")
            }
        }
        if (req.year > 32767 || req.year < 0) {
            e.year = es.addError(e.year, "number can only be the size of smallint unsigned (0-32767)")
        }

        if (req.month > 12 || req.month <= 0) {
            e.month = es.addError(e.month, "number can only be from 1 to 12");
        }

        if (req.day > 31 || req.day <= 0) {
            e.day = es.addError(e.day, "number can only be from 1 to 31")
        }

        if (Object.entries(e).length === 0) {
            return req
        } else {
            throw new HttpException({"code": 400, "message": e, "error": "Bad Request"}, HttpStatus.BAD_REQUEST)
        }
    }

    serveDayStatus(req: StatusDtoRequest) {
        let day_database = this.dayEntityService.find_by_date(req.year, req.month, req.day);
        let day_response = this.configService.getConfig().then(
            async cfg => {
                let hotload: boolean = (cfg.settings.hotload);
                if (cfg.settings.hotload) {
                    let date = req.day + "-" + req.month + "-" + req.year;
                    let country_code = undefined;
                    let region_code = undefined;
                    if (req.country_code == undefined) {
                        // check database for countries
                        // if none check api to see countries to obtain code
                    } else {
                        country_code = req.country_code;
                        region_code = req.region_code;
                    }
                    return await lastValueFrom(this.callendarService.getDay(date, country_code, region_code))
                } else {
                    return null;
                }
            });
        return req;
    }
}
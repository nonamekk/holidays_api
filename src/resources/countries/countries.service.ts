import { Injectable } from '@nestjs/common';
import { map, Observable, tap } from 'rxjs';
import { ICountry } from 'src/integrations/holiday_callendar_api/callendar.interface';
import { CallendarService } from 'src/integrations/holiday_callendar_api/callendar.service';
import { Country } from 'src/models/country/country.entity';
import { CountryEntityService } from 'src/models/country/country.service';
import { OnSyncService } from 'src/utilities/onsync.service';
import { ICountriesListOutput } from './countries.interface';


@Injectable()
export class CountriesService {
    constructor(
        private readonly callendarService: CallendarService,
        private readonly countryEntityService: CountryEntityService,
        private readonly onSyncService: OnSyncService,
    ) {}

    async serveCountryList() {
        return this.countryEntityService.findAllWithRegions()
        .then(x => {
            if (x.length != 0) {
                return this.serveFromDatabase(x);
            }
            return this.serveFromAPI();
        });
    }

    serveFromAPI() {
        let a = this.callendarService.getCountries()
        .pipe(
            tap((x: ICountry[]) => {
                this.countryEntityService.saveAllNew(x).finally();
            }),
            map((x: ICountry[]) => {
                let output: ICountriesListOutput[] = [];
                for (let i = 0; i<x.length; i++) {
                    let regions = [];
                    for (let j=0; j<x[i].regions.length; j++) {
                        regions.push(x[i].regions[j]);
                    }
                    output.push({
                        "country_name": x[i].fullName, 
                        "country_code": x[i].countryCode, 
                        "regions": regions
                    });
                }
                return output;
            })
        )
        return a;
    }


    serveFromDatabase(db_list: Country[]) {
        return new Observable((o) => {
            o.next(db_list);
            o.complete();
        })
        .pipe(
            tap(async (x: Country[]) => {
                // check if onSync (reload) is set in config
                // If settings contain onSync values, this will trigger additional check of countries to try update database current
                if (await this.onSyncService.onTryCall()) {
                    this.callendarService.getCountries().subscribe((call_list: ICountry[]) => {
                        // update if there're new countries or regions
                        this.countryEntityService.tryUpdateFromAPI(x, call_list);
                    });
                }
            }),
            map((x: Country[]) => {
                let output: ICountriesListOutput[] = [];
                for (let i = 0; i<x.length; i++) {
                    let regions = [];
                    if (x[i].regions != undefined) {
                        for (let j=0; j<x[i].regions.length; j++) {
                            regions.push(x[i].regions[j].code)
                        };
                        
                    }
                    output.push({
                        "country_name": x[i].full_name, 
                        "country_code": x[i].code, 
                        "regions": regions
                    });
                    
                }
                return output;
            })
        );

    }


}
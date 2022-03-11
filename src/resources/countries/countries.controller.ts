import { Controller, Get} from '@nestjs/common';
import { CountriesService } from './countries.service';
import { ApiOperation, ApiTags, ApiResponse, ApiBadRequestResponse, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiQuery } from "@nestjs/swagger";



// @ApiTags('Countries')
@Controller('countries')
export class CountriesListController {
    constructor(
        private readonly countriesService: CountriesService,
    ) {}

    @Get()
    @ApiOperation({
        description: "This endpoint returns list of available countries. The results are cached to the database."
    })
    @ApiResponse({
        status: 200,
        description: 'Returns list of countries available, together with their region codes.',
        schema: {
            type: "array",
            example: [
                {
                    "country_name": "Australia",
                    "country_code": "aus",
                    "regions": [
                        "wa",
                        "nsw",
                        "qld",
                        "act",
                        "tas",
                        "vic",
                        "sa",
                        "nt"
                    ]
                },
                {
                    "country_name": "Canada",
                    "country_code": "can",
                    "regions": [
                        "ab",
                        "bc",
                        "mb",
                        "nb",
                        "nl",
                        "nt",
                        "ns",
                        "nu",
                        "on",
                        "pe",
                        "qc",
                        "sk",
                        "yt"
                    ]
                },
                {
                    "country_name": "Germany",
                    "country_code": "deu",
                    "regions": [
                        "bw",
                        "by",
                        "be",
                        "bb",
                        "hb",
                        "hh",
                        "he",
                        "ni",
                        "mv",
                        "nw",
                        "rp",
                        "sl",
                        "sn",
                        "st",
                        "sh",
                        "th"
                    ]
                },
                {
                    "country_name": "New Zealand",
                    "country_code": "nzl",
                    "regions": [
                        "auk",
                        "bop",
                        "can",
                        "gis",
                        "hkb",
                        "mbh",
                        "mwt",
                        "nsn",
                        "ntl",
                        "ota",
                        "stl",
                        "tas",
                        "tki",
                        "wko",
                        "wgn",
                        "wtc",
                        "cit"
                    ]
                },
                {
                    "country_name": "Slovakia",
                    "country_code": "svk",
                    "regions": [
                        "bc",
                        "bl",
                        "ki",
                        "ni",
                        "pv",
                        "ta",
                        "tc",
                        "zi"
                    ]
                },
                {
                    "country_name": "Spain",
                    "country_code": "esp",
                    "regions": [
                        "an",
                        "ar",
                        "as",
                        "cn",
                        "cb",
                        "cl",
                        "cm",
                        "ct",
                        "ce",
                        "ex",
                        "ga",
                        "ib",
                        "ri",
                        "md",
                        "ml",
                        "mc",
                        "nc",
                        "pv",
                        "vc"
                    ]
                },
                {
                    "country_name": "Switzerland",
                    "country_code": "che",
                    "regions": [
                        "ag",
                        "ai",
                        "ar",
                        "bl",
                        "bs",
                        "be",
                        "fr",
                        "ge",
                        "gl",
                        "gr",
                        "ju",
                        "lu",
                        "ne",
                        "nw",
                        "ow",
                        "sg",
                        "sh",
                        "sz",
                        "so",
                        "tg",
                        "ti",
                        "ur",
                        "vs",
                        "vd",
                        "zg",
                        "zh"
                    ]
                },
                {
                    "country_name": "United Kingdom",
                    "country_code": "gbr",
                    "regions": [
                        "eng",
                        "nir",
                        "sct",
                        "wls"
                    ]
                },
                {
                    "country_name": "United States of America",
                    "country_code": "usa",
                    "regions": [
                        "al",
                        "ak",
                        "az",
                        "ar",
                        "ca",
                        "co",
                        "ct",
                        "de",
                        "dc",
                        "fl",
                        "ga",
                        "hi",
                        "id",
                        "il",
                        "in",
                        "ia",
                        "ks",
                        "ky",
                        "la",
                        "me",
                        "md",
                        "ma",
                        "mi",
                        "mn",
                        "ms",
                        "mo",
                        "mt",
                        "ne",
                        "nv",
                        "nh",
                        "nj",
                        "nm",
                        "ny",
                        "nc",
                        "nd",
                        "oh",
                        "ok",
                        "or",
                        "pa",
                        "ri",
                        "sc",
                        "sd",
                        "tn",
                        "tx",
                        "ut",
                        "vt",
                        "va",
                        "wa",
                        "wv",
                        "wi",
                        "wy"
                    ]
                },
                {
                    "country_name": "Hong Kong",
                    "country_code": "hkg",
                    "regions": []
                },
                {
                    "country_name": "Israel",
                    "country_code": "isr",
                    "regions": []
                },
                {
                    "country_name": "Italy",
                    "country_code": "ita",
                    "regions": []
                },
                {
                    "country_name": "Japan",
                    "country_code": "jpn",
                    "regions": []
                },
                {
                    "country_name": "Colombia",
                    "country_code": "col",
                    "regions": []
                },
                {
                    "country_name": "Poland",
                    "country_code": "pol",
                    "regions": []
                },
                {
                    "country_name": "France",
                    "country_code": "fra",
                    "regions": []
                },
                {
                    "country_name": "Mexico",
                    "country_code": "mex",
                    "regions": []
                },
                {
                    "country_name": "Luxembourg",
                    "country_code": "lux",
                    "regions": []
                },
                {
                    "country_name": "Netherlands",
                    "country_code": "nld",
                    "regions": []
                },
                {
                    "country_name": "Croatia",
                    "country_code": "hrv",
                    "regions": []
                },
                {
                    "country_name": "China",
                    "country_code": "chn",
                    "regions": []
                },
                {
                    "country_name": "South Africa",
                    "country_code": "zaf",
                    "regions": []
                },
                {
                    "country_name": "Slovenia",
                    "country_code": "svn",
                    "regions": []
                },
                {
                    "country_name": "Estonia",
                    "country_code": "est",
                    "regions": []
                },
                {
                    "country_name": "Portugal",
                    "country_code": "prt",
                    "regions": []
                },
                {
                    "country_name": "Czech Republic",
                    "country_code": "cze",
                    "regions": []
                },
                {
                    "country_name": "Hungary",
                    "country_code": "hun",
                    "regions": []
                },
                {
                    "country_name": "Belgium",
                    "country_code": "bel",
                    "regions": []
                },
                {
                    "country_name": "Greece",
                    "country_code": "grc",
                    "regions": []
                },
                {
                    "country_name": "Ukraine",
                    "country_code": "ukr",
                    "regions": []
                },
                {
                    "country_name": "Peru",
                    "country_code": "per",
                    "regions": []
                },
                {
                    "country_name": "Macedonia",
                    "country_code": "mkd",
                    "regions": []
                },
                {
                    "country_name": "Isle of Man",
                    "country_code": "imn",
                    "regions": []
                },
                {
                    "country_name": "Philippines",
                    "country_code": "phl",
                    "regions": []
                },
                {
                    "country_name": "Korea (South)",
                    "country_code": "kor",
                    "regions": []
                },
                {
                    "country_name": "Lithuania",
                    "country_code": "ltu",
                    "regions": []
                },
                {
                    "country_name": "Turkey",
                    "country_code": "tur",
                    "regions": []
                },
                {
                    "country_name": "Russian Federation",
                    "country_code": "rus",
                    "regions": []
                },
                {
                    "country_name": "Bosnia and Herzegovina",
                    "country_code": "bih",
                    "regions": []
                },
                {
                    "country_name": "Latvia",
                    "country_code": "lva",
                    "regions": []
                },
                {
                    "country_name": "Romania",
                    "country_code": "rou",
                    "regions": []
                },
                {
                    "country_name": "Finland",
                    "country_code": "fin",
                    "regions": []
                },
                {
                    "country_name": "Norway",
                    "country_code": "nor",
                    "regions": []
                },
                {
                    "country_name": "Belarus",
                    "country_code": "blr",
                    "regions": []
                },
                {
                    "country_name": "Ireland",
                    "country_code": "irl",
                    "regions": []
                },
                {
                    "country_name": "Singapore",
                    "country_code": "sgp",
                    "regions": []
                },
                {
                    "country_name": "Angola",
                    "country_code": "ago",
                    "regions": []
                },
                {
                    "country_name": "Sweden",
                    "country_code": "swe",
                    "regions": []
                },
                {
                    "country_name": "Iceland",
                    "country_code": "isl",
                    "regions": []
                },
                {
                    "country_name": "Serbia",
                    "country_code": "srb",
                    "regions": []
                },
                {
                    "country_name": "Austria",
                    "country_code": "aut",
                    "regions": []
                },
                {
                    "country_name": "Denmark",
                    "country_code": "dnk",
                    "regions": []
                },
                {
                    "country_name": "Chile",
                    "country_code": "chl",
                    "regions": []
                },
                {
                    "country_name": "Brazil",
                    "country_code": "bra",
                    "regions": []
                }
            ]
        }
    })
    @ApiResponse({
        status: 400,
        description: 'Bad Request - could not pass validation'
    })
    @ApiResponse({
        status: 500,
        description: "Internal Server Error"
    })
    getCountriesList() {
        return this.countriesService.serveCountryList();
    }
}
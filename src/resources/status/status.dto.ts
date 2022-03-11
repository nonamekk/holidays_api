// import { IsAlpha, IsOptional, Length, Max, Min, validate } from 'class-validator';

export class StatusDtoRequest {
    // @Min(0)
    // @Max(32767)
    day: number;
    month: number;
    year: number;
    // @IsAlpha()
    // @Length(2, 32)
    // @IsOptional()
    country_name: string | undefined;
    // @IsAlpha()
    // @Length(2, 3)
    // @IsOptional()
    country_code: string | undefined;
    // @IsAlpha()
    // @Length(2, 3)
    // @IsOptional()
    region_code: string | undefined;
}
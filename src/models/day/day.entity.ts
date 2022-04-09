import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { WeekDay } from './day.type';

@Entity()
export class Day {

  @PrimaryGeneratedColumn({
    type: 'smallint'
  })
  id: number;

  @Column({
    type: 'smallint',
    nullable: false
  })
  year: number;

  @Column({
    type: 'smallint',
    nullable: false
  })
  month: number;

  @Column({
    type: 'smallint',
    nullable: false
  })
  day: number;

  // Day of the week 1-7. 
  // Optional in case data not found, but required to save (/status endpoint)
  @Column({
    type: 'smallint',
    nullable: true
  })
  week_day: WeekDay | null = null;

  // identifies if day was checked by all countries and their regions
  // if this is true, then none_in_regions and none_in_countries MUST be null
  @Column({
    type: 'boolean',
    nullable: false,
    default: false
  })
  absolute: boolean;


  // next identifies if country/region was checked
  // comparing having many to many relation and join tables to having an array of ids, it is less consistent,
  // it will be possible to delete data without requiring cascade
  @Column({
    type: 'smallint',
    nullable: true,
    array: true
  })
  holiday_in_countries_ids!: number[]

  @Column({
    type: 'smallint',
    nullable: true,
    array: true
  })
  workday_in_countries_ids!: number[]

  @Column({
    type: 'smallint',
    nullable: true,
    array: true
  })
  none_in_countries_ids!: number[]

  @Column({
    type: 'smallint',
    nullable: true,
    array: true
  })
  holiday_in_regions_ids!: number[]

  @Column({
    type: 'smallint',
    nullable: true,
    array: true
  })
  workday_in_regions_ids!: number[]

  @Column({
    type: 'smallint',
    nullable: true,
    array: true
  })
  none_in_regions_ids!: number[]
}
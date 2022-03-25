import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { Country } from '../country/country.entity';
import { Region } from '../region/region.entity';
import { WeekDay } from './day.type';

// smallint

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
  // comparing to having many to many relation and join tables having an array of ids is less consistent,
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

  // // next identifies if country/region was checked
  // // to have this day as holiday or workday
  // // if it was checked, but it wasn't either then it is none_in_countries and ...
  // // that is done to see if all days for specified country/region was checked
  // // if it was (number of days equal to total days of that year)
  // // all none_in... must be updated, where ids of region/country removed.
  // @ManyToMany(
  //   type => Country, 
  //   country1 => country1.holiday_in_countries,
  //   { nullable: false,
  //     onDelete: 'CASCADE'
  //   }
  // )
  // @JoinTable()
  // holiday_in_countries!: Country[];

  

  // @ManyToMany(
  //   type => Country, 
  //   country2 => country2.workday_in_countries,
  //   { nullable: false,
  //     onDelete: 'CASCADE' }
  // )
  // @JoinTable()
  // workday_in_countries!: Country[];

  // @ManyToMany(
  //   type => Country,
  //   country3 => country3.none_in_countries,
  //   { nullable: false,
  //     onDelete: 'CASCADE' }
  // )
  // @JoinTable()
  // none_in_countries!: Country[]

  // @ManyToMany(
  //   type => Region, 
  //   region1 => region1.holiday_in_regions,
  //   { nullable: false,
  //     onDelete: 'CASCADE' }
  // )
  // @JoinTable()
  // holiday_in_regions!: Region[];

  // @ManyToMany(
  //   type => Region, 
  //   region2 => region2.workday_in_regions,
  //   { nullable: false,
  //     onDelete: 'CASCADE' }
  // )
  // @JoinTable()
  // workday_in_regions!: Region[];

  // @ManyToMany(
  //   type => Region, 
  //   region3 => region3.none_in_regions,
  //   { nullable: false,
  //     onDelete: 'CASCADE' }
  // )
  // @JoinTable()
  // none_in_regions!: Region[];
}
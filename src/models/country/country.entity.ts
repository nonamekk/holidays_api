import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToMany } from 'typeorm';
import { Day } from '../day/day.entity';
import { Region } from '../region/region.entity';

// smallint

@Entity()
export class Country {

  @PrimaryGeneratedColumn({
    type: 'smallint'
  })
  id: number;

  @OneToMany(
    type => Region, 
    region => region.country
  )
  regions!: Region[];

  @Column({
    type: 'varchar',
    length: 3,
    nullable: false
  })
  code: string;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: false
  })
  full_name: string;

  @Column({
    type: 'smallint',
    nullable: true,
    array: true
  })
  years!: number[];

  @Column({
    type: 'boolean',
    nullable: false
  })
  workdays: boolean;

// now initially planned to have epoch for date, but due to
//  1. size - epoch must be 8 bytes integer, 3 smallints are 6 bytes
//  2. conversions to Date
//  3. year maximum is set to 32767
// made it smallint

  @Column({
    type: 'smallint',
    nullable: false
  })
  from_date_year: number;

  @Column({
    type: 'smallint',
    nullable: false
  })
  from_date_month: number;

  @Column({
    type: 'smallint',
    nullable: false
  })
  from_date_day: number;

  @Column({
    type: 'smallint',
    nullable: false
  })
  to_date_year: number;

  @Column({
    type: 'smallint',
    nullable: false
  })
  to_date_month: number;

  @Column({
    type: 'smallint',
    nullable: false
  })
  to_date_day: number;

  // @ManyToMany(
  //   type => Day, 
  //   day => day.holiday_in_countries
  // )
  // holiday_in_countries!: Day[];

  // @ManyToMany(
  //   type => Day, 
  //   day => day.workday_in_countries
  // )
  // workday_in_countries!: Day[];

  // @ManyToMany(
  //   type => Day, 
  //   day => day.none_in_countries
  // )
  // none_in_countries!: Day[];
}
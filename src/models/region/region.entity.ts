import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinTable, OneToMany, ManyToMany } from 'typeorm';
import { Country } from '../country/country.entity';
import { Day } from '../day/day.entity';

// smallint

@Entity()
export class Region {
  @PrimaryGeneratedColumn({
    type: 'smallint'
  })
  id: number;

  @ManyToOne(
    type => Country,
    country => country.regions,
    { nullable: false,
      cascade: true
    }
  )
  country: Country;

  @Column({
    type: 'varchar',
    length: 3,
    nullable: false
  })
  code: string;

  @Column({
    type: 'smallint',
    nullable: true,
    array: true
  })
  years!: number[];

  // @ManyToMany(
  //   type => Day, 
  //   day => day.holiday_in_regions
  // )
  // holiday_in_regions!: Day[];

  // @ManyToMany(
  //   type => Day, 
  //   day => day.workday_in_regions
  // )
  // workday_in_regions!: Day[];

  // @ManyToMany(
  //   type => Day, 
  //   day => day.none_in_regions
  // )
  // none_in_regions!: Day[];
}
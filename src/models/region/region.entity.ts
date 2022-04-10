import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Country } from '../country/country.entity';


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
}
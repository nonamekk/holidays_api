import { Connection } from 'typeorm';
import { Day } from './day.entity';

export const dayEntityProviders = [
  {
    provide: 'DAY_REPOSITORY',
    useFactory: (connection: Connection) => connection.getRepository(Day),
    inject: ['DATABASE_CONNECTION'],
  },
];

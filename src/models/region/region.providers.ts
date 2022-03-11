import { Connection } from 'typeorm';
import { Region } from './region.entity';

export const regionEntityProviders = [
  {
    provide: 'REGION_REPOSITORY',
    useFactory: (connection: Connection) => connection.getRepository(Region),
    inject: ['DATABASE_CONNECTION'],
  },
];

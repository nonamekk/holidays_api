import { createConnection } from 'typeorm';
import config from '../config/configuration';

const cfg = config();
export const databaseProviders = [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async () => await createConnection({
        type: cfg.database.type,
        host: cfg.database.host,
        port: cfg.database.port,
        username: cfg.database.username,
        password: cfg.database.password,
        database: cfg.database.database_name,
        entities: [
            __dirname + '/../models/**/*.entity{.ts,.js}',
        ],
        migrations: [__dirname + './migrations/migration/*.{.ts, .js}'],
        cli: {
          migrationsDir: "migrations"
        },
        // remove synchronize for production (can lose production data)
        synchronize: true,
        cache: true
      }),
    },
  ];
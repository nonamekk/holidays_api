const fs = require('fs');
const config = require('../../dist/config/configuration.js').default;

const cfg = config();
const ormconfig = {
  type: cfg.database.type,
  host: cfg.database.host,
  port: cfg.database.port,
  username: cfg.database.username,
  password: cfg.database.password,
  database: cfg.database.database_name,
  entities: [
      __dirname + '/../../dist/models/**/*.js}',
  ],
  migrations: [
      __dirname + '/../../dist/database/migrations/migration/*.js}'
  ],
  cli: {
    migrationsDir: __dirname + '/../../dist/database/migrations'
  },
  // remove synchronize for production (can lose production data)
  synchronize: true,
  logging: false
};
let cfg_string = JSON.stringify(ormconfig);
// writing it in a single line string...
fs.writeFile("ormconfig.json", cfg_string, (err) => {
  (err)?
    console.log(err)
  : console.log("ormconfig.json has been created")
});

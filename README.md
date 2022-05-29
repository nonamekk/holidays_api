<p align="center">
  <a href=""><img src="/assets/images/callendar.png" width="140" /></a>
</p>

<h4 align="center">
  Holidays API Callendar
</h4>
<p align ="center">
  The on demand caching country holiday and workdays API server
</p>

## Description


Main task is to serve 4 endpoints to provide information about holidays, workdays and countries for which data is available. After the data is obtained from the third-party API it is saved to the PostgreSQL database. 

The data is obtained from https://kayaposoft.com/enrico/.

Main scope was to create a small application, that would be error-prone, configurable, minimal and reliable.


## Endpoints

The application serves 4 endpoints which return JSON as a response.

| **Endpoint**            | **Description**                                                                                                                                                                                                                                                                                                              | **Query Params** |
|-------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------|
| <code>/countries</code> | Returns list of countries and their regions available. <br> Saves new, updates if data different different. <br> Has setting to check country list after request to check for changes.                                                                                                                                       | No               |
| <code>/holidays</code>  | Returns list of months with holiday days. <br> Saves new, updates existing, registers that all days are saved for requested year. <br> Has setting to hotload data from third-party API before making request to the database.                                                                                               | Yes              |
| <code>/status</code>    | Returns day status (*holiday*, *workday*, *freeday*) <br> Saves new, updates existing, registers if all days are saved for one country (or region). <br> Can register that day was checked by all countries (and their regions) <br> Has setting to hotload data from third-party API before making request to the database. | Yes              |
| <code>/freedays</code>  | Returns max number of freedays in a year <br> Saves new, updates existing, registers that all days are saved for requested year. <br> Has setting to hotload data from third-party API before making request to the database.                                                                                                | Yes              |
| <code>/api</code>       | API documentation generated with Swagger on the endpoints above                                                                                                                                                                                                                                                              |                  |
## Installation

```bash
$ npm install
```

## Running the app

To connect application to the database it is required to change database settings in the <code>config.yaml</code> to match yours.

Application default port is <code>3001</code>.

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

To enable <code>/countries</code> additional country check after response change <code>try_source_after_success</code> to <code>true</code>.

To enable hotload set <code>hotload</code> to <code>true</code>.



<!-- ## Tests

Unit tests of the solution are not provided, only default created by NestJS

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

--- -->

## Author

[Kiril Krutiajev](https://github.com/nonamekk)

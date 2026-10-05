<h1 align="center">
abrechnung 🧾
</h1>
<p align="center">
<a href="https://github.com/david-loe/abrechnung/actions/workflows/migration-test.yml"><img src="https://github.com/david-loe/abrechnung/actions/workflows/migration-test.yml/badge.svg" alt="Migration & Test"></a>
<a href="https://hub.docker.com/r/davidloe/abrechnung-backend"><img src="https://img.shields.io/docker/pulls/davidloe/abrechnung-backend?logo=docker" alt="Docker Pulls"></a>
</p>
<h3 align="center"  style="margin-top: 0px; margin-bottom: 30px">
Demo und Hosting ➡️ <a href="https://reiseabrechner.de">reiseabrechner.de</a>
</h3>

**abrechnung 🧾** ist eine Web App die:

- Reisekosten- (inkl. automatischer Pauschalen Berechnung auch für internationale Reisen),
- Auslagen- und
- Krankenkosten-Abrechnungen

digital und einfach möglich macht.

https://github.com/david-loe/abrechnung/assets/56305409/8b31b6a1-e6c4-4bd9-bb76-3871e046a201

## Dokumentation

### [Anwendung](https://david-loe.github.io/abrechnung-doc/)

#### [REST-API](https://david-loe.github.io/abrechnung/)

## Pauschalbeträge

[pauschbetrag-api](https://github.com/david-loe/pauschbetrag-api)

## Wechselkurse

Auswahl zwischen

- tagesaktuell [Frankfurter](https://frankfurter.dev/)

- Monatskurse von [InforEuro](https://commission.europa.eu/funding-tenders/procedures-guidelines-tenders/information-contractors-and-beneficiaries/exchange-rate-inforeuro_en)

## Development Environment

1. Install [Docker & Docker Compose](https://docs.docker.com/engine/install/)
2. Copy `.env.example` to `.env` and adapt if needed
3. Run `docker compose up`
4. Login via:
   - `http://localhost:5000` with `professor:professor` (with test LDAP and `NODE_ENV=development`)  
     OR
   - Login link in backend logs

> ℹ You can change ports and URLs in the `.env` file

### Development dependencies and checks

Development containers keep dependencies in the local `node_modules` directories for editor and local npm usage. The first start synchronizes dependencies from the image; unchanged starts skip copying. Rebuild the affected image after changing `package.json` or `package-lock.json`. If dependencies were manually changed or damaged, remove that package's `node_modules/.dependency-id` marker and restart its container.

With `NODE_ENV=development` in `.env`, run checks sequentially from the repository root:

```sh
docker compose build common backend frontend ldap inbucket
docker compose run --rm --no-deps --pull never common npm run test
docker compose up -d db redis ldap inbucket
docker compose run --rm --no-deps --pull never backend sh -c 'npm run setup && npm run test:built'
docker compose run --rm --no-deps --pull never frontend npm run test
docker compose run --rm --no-deps --pull never -e NODE_ENV=production frontend npm run build
```

The common tests also build the shared package. For an individual backend or frontend check, first run `docker compose run --rm --no-deps --pull never common npm run build`. Backend tests use and modify the configured development database. `--no-deps` prevents test containers from starting application services implicitly; `--rm` removes the finished test containers. Existing development services are left running.

## Contributing

Erstelle gerne <a href="https://github.com/david-loe/abrechnung/issues">Issues</a> oder <a href="https://github.com/david-loe/abrechnung/pulls">PR's</a> ([Contributing Guidelines](./CONTRIBUTING.md))!

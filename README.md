<h1 align="center">
abrechnung 🧾
</h1>
<p align="center">
<a href="https://github.com/david-loe/abrechnung/actions/workflows/production-build.yml"><img src="https://github.com/david-loe/abrechnung/actions/workflows/production-build.yml/badge.svg" alt="Production Build"></a>
<a href="https://github.com/david-loe/abrechnung/actions/workflows/migration-test.yml"><img src="https://github.com/david-loe/abrechnung/actions/workflows/migration-test.yml/badge.svg" alt="Migration & Test"></a>
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

[InforEuro](https://commission.europa.eu/funding-tenders/procedures-guidelines-tenders/information-contractors-and-beneficiaries/exchange-rate-inforeuro_en)

Dieser statische Währungsrechner zeigt den offiziellen monatlichen Buchungskurs der Europäischen Kommission für den Euro und die durch den Rechnungsführer im Einklang mit Artikel 19 der Haushaltsordnung festgelegten Umrechnungskurse an.

## Run

### Gitpod

Click below to launch a ready-to-use Gitpod workspace in your browser.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/david-loe/abrechnung)

### Local

1. Install [Docker & Docker Compose](https://docs.docker.com/engine/install/)
2. Copy `.env.example` to `.env` and adapt if needed
3. Run `docker compose up`
4. Login via:
   - `http://localhost:5000` with `professor:professor` (with test LDAP and `NODE_ENV=development`)  
     OR
   - Login link in backend logs

> ℹ You can change ports and URLs in the `.env` file

## Contributing

Erstelle gerne <a href="https://github.com/david-loe/abrechnung/issues">Issues</a> oder <a href="https://github.com/david-loe/abrechnung/pulls">PR's</a> ([Contributing Guidelines](./CONTRIBUTING.md))!

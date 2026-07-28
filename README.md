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

### OCR and AI suggestions

The frontend build downloads the pinned PP-OCRv6-small models (about 31 MB), verifies their SHA-256 checksums and serves the models, PDF worker and ONNX/WASM runtime locally. After login the browser initializes OCR in the background; receipt data is not sent to an external OCR service.

The development Compose setup starts Ollama, pulls `qwen3:0.6b` into the persistent `ollama_data` volume and runs a structured-output smoke test before starting the backend. Fresh development databases use `http://ollama:11434/v1` for receipt suggestions. Existing development settings are only populated when the LLM section does not exist; setting it to `null` disables suggestions. Production instances must configure an OpenAI-compatible base URL and model under Connection Settings. The API key is optional, reasoning effort defaults to `none` and can be cleared to omit the provider parameter, and the request timeout defaults to 180 seconds. OCR text is sent to that configured LLM endpoint when suggestions are requested.

## Contributing

Erstelle gerne <a href="https://github.com/david-loe/abrechnung/issues">Issues</a> oder <a href="https://github.com/david-loe/abrechnung/pulls">PR's</a> ([Contributing Guidelines](./CONTRIBUTING.md))!

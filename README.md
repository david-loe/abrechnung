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

### MCP für LLM-Clients

Das Backend stellt unter `${VITE_BACKEND_URL}/mcp` einen Remote-MCP-Server über Streamable HTTP bereit. Unterstützt wird ausschließlich MCP `2026-07-28`; ältere MCP-Transporte und Protokollstände werden abgewiesen.

Die Aktivierung erfolgt in den Verbindungseinstellungen:

1. OIDC mit Server, Client-ID und Client-Secret konfigurieren.
2. Unter `MCP OAuth` die Audience eintragen, für die der OIDC-Provider Access Tokens ausstellt.
3. Beim OIDC-Provider den Scope `mcp` und die MCP-Resource `${VITE_BACKEND_URL}/mcp` konfigurieren.

Ein Access Token muss vom konfigurierten OIDC-Issuer signiert sein, die konfigurierte Audience und den Scope `mcp` enthalten. Sein `sub` wird ausschließlich über `User.fk.oidc` einem aktiven Abrechnung-Benutzer mit `access.user` zugeordnet; es gibt keine automatische Benutzeranlage oder Verknüpfung.

Die angebotenen Tools richten sich nach den bestehenden Berechtigungen des Benutzers. Dazu gehören eigene Reise- und Vorschussanträge sowie Auslagenabrechnungen, Belege als Base64-Upload, PDF-Abruf und – bei entsprechendem Special Access – Genehmigung, Prüfung, Anlage für andere Benutzer und Buchungsexporte. Schreibende beziehungsweise irreversible Tools sind mit MCP-Annotations gekennzeichnet, damit Clients vor ihrer Ausführung eine Bestätigung einholen können.

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

## Contributing

Erstelle gerne <a href="https://github.com/david-loe/abrechnung/issues">Issues</a> oder <a href="https://github.com/david-loe/abrechnung/pulls">PR's</a> ([Contributing Guidelines](./CONTRIBUTING.md))!

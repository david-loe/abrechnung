<h1 align="center">
  abrechnung 🧾
</h1>
<p align="center">
  <a href="https://github.com/david-loe/abrechnung/actions/workflows/migration-test.yml"
    ><img src="https://github.com/david-loe/abrechnung/actions/workflows/migration-test.yml/badge.svg" alt="Migration & Test"></a
  >
  <a href="https://hub.docker.com/r/davidloe/abrechnung-backend"
    ><img src="https://img.shields.io/docker/pulls/davidloe/abrechnung-backend?logo=docker" alt="Docker Pulls"></a
  >
</p>
<h3 align="center" style="margin-top: 0px; margin-bottom: 30px">
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

## Contributing

Erstelle gerne <a href="https://github.com/david-loe/abrechnung/issues">Issues</a> oder <a href="https://github.com/david-loe/abrechnung/pulls">PR's</a> ([Contributing Guidelines](./CONTRIBUTING.md))!

### Passkeys

Passkeys ermöglichen die Anmeldung ohne Benutzername über ein Gerät oder einen FIDO2-Sicherheitsschlüssel. Nutzer können in ihren persönlichen Einstellungen mehrere Passkeys anlegen, benennen und entfernen. Die erste Einrichtung erfolgt nach Anmeldung über ein bestehendes Verfahren; diese Verfahren bleiben auch bei Verlust eines Passkeys nutzbar.

Der Schalter unter Administration → Anzeigeeinstellungen → Authentifizierung aktiviert Anmeldung und Neuanlage. Bei Neuinstallationen sind Passkeys eingeschaltet, bei bestehenden Installationen nach dem Update zunächst ausgeschaltet. Auch bei ausgeschaltetem Schalter können Nutzer vorhandene Passkeys anzeigen, umbenennen und löschen. Das Löschen in der App widerruft den Zugang; ein Eintrag im Passwortmanager muss dort gegebenenfalls separat entfernt werden.

Das Frontend benötigt HTTPS; für lokale Entwicklung ist auch `localhost` möglich. Die RP-ID entspricht dem Hostnamen von `VITE_FRONTEND_URL`, der erlaubte WebAuthn-Origin dessen Origin einschließlich Port. Änderungen des Hostnamens erfordern eine erneute Einrichtung der Passkeys. Backend und Frontend verwenden die bestehende Cookie-Sitzung und müssen entsprechend der vorhandenen Proxy-/Cookie-Konfiguration erreichbar sein.

# reisekostenabrechnung

[![Production Build](https://github.com/david-loe/reisekostenabrechnung/actions/workflows/production-build.yml/badge.svg)](https://github.com/david-loe/reisekostenabrechnung/actions/workflows/production-build.yml)
[![Backend Test](https://github.com/david-loe/reisekostenabrechnung/actions/workflows/backend-test.yml/badge.svg)](https://github.com/david-loe/reisekostenabrechnung/actions/workflows/backend-test.yml)

Reisekostenabrechnung inkl. automatischer Pauschalen Berechnung auch für internationale Reisen

![Video](media/video/reisekostenabrechnung-DE-SMALL.mp4)

## Getting Started

1. Install [Docker & Docker Compose](https://docs.docker.com/engine/install/)
2. Run `docker compose up`
3. Open `http://localhost:5000` and login with `professor:professor`

> ℹ You can change ports and URLs in the `.env` file

## Pauschalbeträge

- Deutschland: Verpflegung [§9 Abs. 4a S. 3 EStG](https://www.gesetze-im-internet.de/estg/__9.html) - Übernachtung [§7 Abs. 1 BRKG](https://www.gesetze-im-internet.de/brkg_2005/__7.html)
- Andere Länder: [Steuerliche Behandlung von Reisekosten und Reisekostenvergütungen](https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Lohnsteuer/2022-11-23-steuerliche-behandlung-reisekosten-reisekostenverguetungen-2023.pdf)

## Schema

![Schema](schema.png)

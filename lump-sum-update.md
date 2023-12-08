# Update Lump Sums

1. Get the new PDF from [**Bundesministerium der Finanzen**](https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Lohnsteuer/2023-11-21-steuerliche-behandlung-reisekosten-reisekostenverguetungen-2024.pdf)
2. Convert PDF to Excel [e.g. here](https://smallpdf.com/de/pdf-in-excel)
3. Copy lump sum table to a new `tsv` file with the following first line, save as `backend/data/lumpSums_YYYY-MM-DD.tsv`

```tsv
country	catering24	catering8	overnight
```

4. run `docker compose exec -T backend npm run parse-lumpsums`

## Lump Sums for Germany

Keep in mind that the lump sums for germany are not included in the puplications of the `Bundesministerium der Finanzen`.

To Update the lump sums of germany add a line manualy to the corresponding lump sum file.

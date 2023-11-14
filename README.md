# import-files-p360
Script som håndterer import av filer til uregistrerte og strekkode import

## Strekkode import
Kjøres med
`npm run import-strekkode-to-p360`
Fra rotnivå her

### Flyt
- Sjekker BARCODE_INPUT_DIR for filer
- For hver fil:
  - Sjekker om gyldige verdier i filtittel på formatet "${documentRecno}_${versionID}_${documentType (HOVED ELLER VEDLEGG)}.ext"
  - Dersom tittel ikke er gyldig sendes dokumentet til uregistrerte. Filen flyttes til BARCODE_IMPORTED_TO_UNREG_DIR
  - Dersom tittel er gyldig, laster vi opp filene til p360 dokumentet med recno lik ${documentRecno}. Dersom det allerede eksisterer en fil i p360dokumnetet, legges alle filer til som vedlegg, selv om ${documentType} er satt til HOVED. Filen flyttes til BARCODE_IMPORTED_DIR

**MERK** Per nå flyttes ikke filer som feiler i opplastingen av fil til P360, kan derfor oppstå en kjip loop.

## Logger
Logger finner du i logs mappen etter at script er kjørt


## Teams alert on warn and error
Simply add environment variable in .env:
`TEAMS_WEBHOOK_URL="teams_channel_webhook_url_you_got_from_teams"`
And logs with level WARN and ERROR will show up in the teams channel

## Setup
Sjekk at du har Node installert (versjon 18 eller nyere)

```bash
npm i
```

Opprett en .env fil med følgende verdier:
```bash
BARCODE_INPUT_DIR="absolutt sti til der scriptet henter filer for strekkode import"
BARCODE_IMPORTED_DIR="absolutt sti til der scriptet legger ferdige filer etter strekkode import"
BARCODE_IMPORTED_TO_UNREG_DIR="absolutt sti til der scriptet legger ferdige filer etter strekkode import som havnet i uregistrete"
P360_URL="https://{domain}/Biz/v2/api/call/SI.Data.RPC/SI.Data.RPC"
P360_AUTHKEY="nykjel til arkivet ditt"
TEAMS_WEBHOOK_URL="teams_channel_webhook_url_you_got_from_teams" # Hvis du ønsker varsling i Teams på feil
```
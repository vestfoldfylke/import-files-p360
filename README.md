# import-files-p360
Script som håndterer import av scannede filer til p360

## PIXEDIT-flyt (Fra scannerne)
**Hvordan flyter dokumenter fra scanner til ulike script og mapper**
- Filer kommer fra Canon til Autostore og deretter til pixedit-server - i mappen `C:\ScanTo360\uniFLOWinput` med filnavn - {navn på person som skannet}_{timestamp for skanning}.pdf + thilhørende json-fil
- Scriptet til Nils leser json og renamer filen til Canon_{epost til person som skannet}__{navn på som person som skannet}_{timestamp}.pdf - legger i mappen C:\ScanTo360\Input
- Pixedit lytter på C:\ScanTo360\Input
  - Kjører OCR og litt annet (deskewing og sånt - sjekk Pixedit-profilen)
  - Hvis strekkode
    - Flytter til BARCODE_INPUT_DIR (.env)
  - Hvis strekkode feiler **MERK** Dette er en fancy instilling i Pixedit, som leser strekkode, hvis den feiler antar vi at den skal til uregistrerte. Sjekk Pixedit profilen + pixedit-server innstillinger
    - Flytter til C:\ScanTo360\UnregisteredOCR
- Pixedit lytter på C:\ScanTo360\UnregisteredOCR
  - Kjører OCR og litt annet (deskewing og sånt - sjekk Pixedit-profilen)
  - Flytter til UNREGISTERED_INPUT_DIR (.env)
  - Herifra tar scriptet import-to-unregistered over jobben

## Strekkode import (import-barcode-to-p360)
Kjøres med
`node ./scripts/import-barcode-to-p360.js`
Fra rotnivå her

### Flyt
- Sjekker BARCODE_INPUT_DIR for filer
- For hver fil:
  - Sjekker om gyldige verdier i filtittel på formatet "${documentRecno}_${versionID}_${documentType (HOVED ELLER VEDLEGG)}.{ext}"
  - Dersom tittel ikke er gyldig sendes dokumentet til uregistrerte. Filen flyttes til BARCODE_IMPORTED_TO_UNREG_DIR
  - Dersom tittel er gyldig, laster vi opp filene til p360 dokumentet med recno lik ${documentRecno}. Dersom det allerede eksisterer en fil i p360-dokumentet, legges alle filer til som vedlegg, selv om ${documentType} er satt til HOVED. Filen flyttes til BARCODE_IMPORTED_DIR

**MERK** Per nå flyttes ikke filer som feiler i opplastingen av fil til P360, kan derfor oppstå en kjip loop.

## Uregistrerte import (import-to-unregistered-p360)
Kjøres med
`node ./scripts/import-to-unregistered-p360.js`
Fra rotnivå her

### Flyt
- Sjekker UNREGISTERED_INPUT_DIR for filer
- For hver fil:
  - Hent innsenders/innskanners epost fra filnavnet
  - Slår opp i AD (OU={UNREGISTERED_AD_MAIN_COUNTY_OU}) og henter DisplayName og Company
    - Hvis ikke treff på EmailAddress, slår opp i OU=VTFK og henter DisplayName og Company
      - Hvis fortsatt ikke treff - setter "Ukjent virksomhet" i stedet for company og bruker innsenders e-post istedet for DisplayName
  - Henter teksten i pdf-filen
  - Sjekker om teksten i pdf-filen matcher et vitnemål eller kompetansebevis
  - Hvis match på kompetansebevis eller vitnemål:
    - Sjekker om vi har nok data til å arkivere (gyldig fnr, dato, skole osv)
      - Hvis nok data, flyttes filen til VITNEMAL_INPUT_DIR eller KOMPETANSEBEVIS_INPUT_DIR, og scriptet fortsetter til neste fil
  - Går gjennom tekstlinjene i pdf-en og finner en linje som kan ligne på en tittel for dokumentet
  - Sender dokumentet til uregistrerte, med tittel, og et notat med hvem som har skannet + tidspunkt for skanning

## Vitnemål-arkivering (archive-vitnemal)
Kjøres med
`node ./scripts/archive-vitnemal.js`
Fra rotnivå her

### Flyt
- Sjekker VITNEMAL_INPUT_DIR for filer
- For hver fil:
  - Henter teksten i pdf-filen
  - Sjekker at vi har data for å arkivere automatisk
  - Kjører SyncElevmappe (oppretter / oppdaterer elevmappe og returnerer CaseNumber)
  - Arkiverer vitnemålet

## Kompetansebevis-arkivering (archive-kompetansebevis)
Kjøres med
`node ./scripts/archive-kompetansebevis.js`
Fra rotnivå her

### Flyt
- Sjekker KOMPETANSEBEVIS_INPUT_DIR for filer
- For hver fil:
  - Henter teksten i pdf-filen
  - Sjekker at vi har data for å arkivere automatisk
  - Kjører SyncElevmappe (oppretter / oppdaterer elevmappe og returnerer CaseNumber)
  - Arkiverer kompetansebeviset

## Logger
Logger finner du i logs mappen etter at script er kjørt

## Teams alert on warn and error
Sleng inn miljovariabel i .env:
`TEAMS_WEBHOOK_URL="teams_channel_webhook_url_you_got_from_teams"`
Da får du pling i teams ved loglevel WARN og høyere

## Setup
Klon ned prosjektet fra github (git clone repo-url)

Sjekk at du har Node installert (versjon 18 eller nyere)

```bash
npm i
```

Opprett en .env fil med følgende verdier:
```bash
BARCODE_INPUT_DIR="sti til der scriptet henter filer for strekkode import"
UNREGISTERED_INPUT_DIR="sti til input filer for uregistrerte"
UNREGISTERED_UNNECESSARY_XML_DIR="sti til der xml-filer skal jevnlig slettes"
UNREGISTERED_AD_MAIN_COUNTY_OU="navn på OU som vi skal lete etter ad-bruker først"
UNREGISTERED_GET_AD_USER="true/false" # Om man skal kjøre get-aduser
COUNTY_NUMBER="39" # Fylkesnummer
APPREG_CLIENT_ID="app reg client id"
APPREG_CLIENT_SECRET="app reg client secret"
APPREG_TENANT_ID="app reg tenant id"
ARCHIVE_URL="archive api url"
ARCHIVE_SCOPE="archive api scope"
KOMPETANSEBEVIS_INPUT_DIR="sti til input for kompetansebevis"
KOMPETANSEBEVIS_FALLBACK_ACCESS_GROUP="Hvilken tilgangsgruppe brukes om man ikke finner skole"
KOMPETANSEBEVIS_FALLBACK_ORGANIZATION_NUMBER="Hvilken ansvarlig virksomhet brukes om man ikke finner skole"
VITNEMAL_INPUT_DIR="sti til input for vitnemål"
VITNEMAL_FALLBACK_ACCESS_GROUP="Hvilken tilgangsgruppe brukes om man ikke finner skole"
VITNEMAL_FALLBACK_ORGANIZATION_NUMBER="Hvilken ansvarlig virksomhet brukes om man ikke finner skole"
STATISTICS_URL="url til statistikk api"
STATISTICS_KEY="api nøkkel til statistikk api"
TEAMS_WEBHOOK_URL="teams_channel_webhook_url_you_got_from_teams" # Hvis du ønsker varsling i Teams på feil
```
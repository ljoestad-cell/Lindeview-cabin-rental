# Lindeview

Nettside og bookingløsning for utleie av Lindeview (Next.js, hostet på Vercel).

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # enhetstester (Vitest) for pris, datoer, avbestilling, overlapp og iCal
```

## Booking & admin

Nettsiden har en bookingflyt (`/book`) og et admin-panel (`/admin`) for å
godkjenne/avslå forespørsler. Faste regler ligger i
[lib/config.ts](lib/config.ts) — sesong, minimum opphold, maks antall
tillegg og standardprisene.

### Priser

Alle priser endres under **Priser** i admin (`/admin/priser`): pris per natt,
rengjøringsgebyr, depositum og prisen på hvert tillegg. De lagres i samme
lager som bookingene (Redis i produksjon), så endringer gjelder med en gang
uten ny deploy. Til du har lagret noe der, brukes standardprisene fra
[lib/config.ts](lib/config.ts).

Nye priser gjelder kun nye bookingforespørsler. Bookinger som allerede er
sendt inn beholder prisen og depositumet gjesten så da de sendte forespørselen.

### Tillegg som påvirker prisen

Gjesten velger antall (0 = ikke valgt) for tre tillegg på `/book`, fast pris
pr. booking (ikke pr. natt). Prisene settes under «Priser» i admin:

| Tillegg | Maks antall | Standardpris |
|---|---|---|
| Lading av el-bil | 4 | 60 EUR pr. bil |
| Kjæledyr | 4 | 60 EUR pr. dyr |
| Sengetøy & håndklær | 10 | 25 EUR pr. sett |

Bookingsiden viser også tydelig at hytta kun leies ut til familier, ikke
voksne grupper, firmaer eller arrangementer
([lib/config.ts](lib/config.ts): `FAMILY_ONLY_NOTICE`).

Sesongteksten («1. mai – 30. september 2027») lages automatisk fra
`SEASON_START`/`SEASON_END` i [lib/config.ts](lib/config.ts). Når sesongen skal
flyttes, endrer du bare datoene.

### Leievilkår og avbestilling

Gjesten må krysse av for [leievilkårene](app/vilkar/page.tsx) og
[personvernerklæringen](app/personvern/page.tsx) før forespørselen kan sendes.
Vilkårsversjonen (`TERMS_VERSION`) og tidspunktet lagres på bookingen. Endrer
du teksten i vilkårene, må du også sette `TERMS_VERSION` til dagens dato.

Avbestillingsreglene står i [lib/config.ts](lib/config.ts), og tallene vises
automatisk i vilkårene:

| Når gjesten avbestiller | Refusjon |
|---|---|
| Minst 30 dager før innsjekk | Det som er betalt (normalt bare forskuddet), minus et gebyr på 2 % av hele leien (`CANCELLATION_FEE_SHARE`), som trekkes fra forskuddet. Gebyret dekker Stripe-gebyret på forskuddet med god margin |
| Mindre enn 30 dager før | Ingenting |

Gebyret gjelder ikke bookinger fra før forskudd ble innført (de godtok gratis
avbestilling). Beløpet gjesten får tilbake står i godkjennings- og
bekreftelses-e-posten, på Stripe-betalingssiden og på «Min booking».

For en booking der noe er betalt (også bare forskuddet) har admin to knapper. **«Gjesten avbestiller»**
refunderer etter tabellen over, og beløpet står på knappen. **«Vi avlyser»**
refunderer alt. Det som er refundert, vises på bookingen. Begge (og
«Avbestill» på ubetalte bookinger) åpner en bekreftelse der du velger om
gjesten skal få avbestillings-e-post.

Admin kan ikke bekrefte en forespørsel som overlapper en allerede bekreftet
booking eller en blokkert periode. Det gir en feilmelding i stedet for
dobbeltbooking.

### Gjestens bookingside («Min booking»)

Gjestene har ingen konto. Hver booking får i stedet en hemmelig lenke,
`/booking/<token>`, som vises etter innsendt forespørsel og står i begge
gjeste-e-postene. Der ser gjesten status, datoer, pris, betaling, depositum,
tilleggsbeløp, refusjoner og fristen for gratis avbestilling. Bare fornavnet
vises av personopplysningene, og siden indekseres ikke av søkemotorer.

Gjesten kan:
- **betale forskuddet og sikre kortet, eller bytte kort** (ny Stripe-lenke hver
  gang, så lenken i e-posten som utløper etter et døgn er ikke et problem).
  Ikke mulig etter at resten er trukket.
- **betale resten selv** («Betal resten», med 3D Secure) hvis det automatiske
  trekket feilet.
- **be om avbestilling**, med en valgfri melding. Det avbestiller ikke noe: du
  får e-post, bookingen får et gult merke i admin, og du avbestiller selv med
  knappene over.

«Kopier gjestelenke» i admin gir lenken for en booking, og lager den for
eldre bookinger som mangler. Lenken slettes når bookingen anonymiseres.

### Sikkerhetskopi

Bookinger, blokkeringer, priser og kontoinnstillinger finnes bare i databasen.
Under «Min konto» → «Sikkerhetskopi» kan du laste ned:

- **Full sikkerhetskopi (JSON):** alt, uten passordhash, MFA-hemmelighet og reservekoder.
- **Bookinger som regneark (CSV):** én rad per booking med status, beløp,
  betaling og depositum. Filen åpnes riktig i norsk Excel (semikolon og
  desimalkomma).

Last ned en kopi jevnlig, for eksempel én gang i måneden, og lagre den et
trygt sted. Det finnes ingen gjenopprettingsknapp. JSON-filen er råmaterialet
hvis data en gang må legges tilbake.

### Personvern

Navn, e-post, telefon og melding anonymiseres automatisk av den daglige
cron-jobben (`/api/cron/charges`). Bekreftede bookinger anonymiseres 5 år
etter utsjekk (bokføringsloven), og andre forespørsler etter 6 måneder
(`RETENTION_MONTHS_*` i [lib/config.ts](lib/config.ts)). Datoer og beløp
beholdes.

### Beskyttelse mot misbruk

- Admin-innlogging: maks 10 forsøk per IP per 15 minutter. Deretter svarer
  API-et med 429.
- Bookingskjemaet: maks 5 forespørsler per IP per time, pluss et skjult
  honeypot-felt som stopper enkle bots uten at noe lagres.
- «Min booking»: maks 20 ukjente lenker per IP per 15 minutter (stopper
  gjetting), og maks 10 handlinger (kortlenke, avbestilling) per IP per time.

Tellerne ligger i samme lager som bookingene (Redis i produksjon, i minnet
lokalt). Grensene settes i [lib/rate-limit.ts](lib/rate-limit.ts).

### Søkemotorer og deling

`robots.txt`, `sitemap.xml`, et delingsbilde (`app/opengraph-image.jpg`) og
strukturerte data (schema.org `VacationRental`) genereres automatisk. Admin og
API er stengt for søkemotorer. Adressene bygges fra `NEXT_PUBLIC_SITE_URL`,
eller fra Vercels produksjons-URL hvis den ikke er satt.

### Domene

Siden ligger på **https://www.lindeview.no** (domenet er kjøpt hos
Domeneshop, DNS styres der under **DNS-pekere → Vis avanserte
innstillinger**). `lindeview.no` sender videre (308) til `www`.

| Vertsnavn | Type | Verdi | Brukes av |
|---|---|---|---|
| *(tomt)* | A | `216.198.79.1` | Vercel |
| `www` | CNAME | `….vercel-dns-017.com` (se Vercel → Domains) | Vercel |
| `send`, `rsend` | CNAME | `….forge.rmta.net` | Resend (sending) |
| `resend._domainkey` | TXT | DKIM-nøkkel fra Resend | Resend |
| `_dmarc` | TXT | `v=DMARC1; p=none` | e-post |

`NEXT_PUBLIC_SITE_URL=https://www.lindeview.no` er satt i Vercel
(Production). Domenet har ingen innkommende e-post — kontaktadressen på
siden er eierens egen.

### Admin-kalender og datoblokkering

`/admin` har en kalender som viser bekreftede bookinger, ubehandlede
forespørsler og manuelt blokkerte perioder i én oversikt
([components/admin/AdminCalendar.tsx](components/admin/AdminCalendar.tsx)).
Eieren kan velge en ledig periode og blokkere den (eget bruk, vedlikehold
o.l.) med en valgfri årsak — blokkerte datoer telles automatisk med i
tilgjengeligheten på `/book`, så gjester ikke kan sende forespørsel for dem.

### Kalendersynkronisering med Airbnb

Hytta leies også ut via Airbnb (lenke i [lib/property.ts](lib/property.ts):
`AIRBNB_URL`) parallelt med denne siden, så uten synkronisering kan samme
datoer bookes to steder. Under «Kalendersynkronisering» på `/admin/account`:

1. **Lindeview → Airbnb**: kopier lenken som vises der, og lim den inn i
   Airbnb under Kalender → Tilgjengelighet → Synkroniser kalendere →
   «Importer kalender». Lenken er ugjettbar (en tilfeldig token,
   `icalExportToken` på admin-kontoen) i stedet for passordbeskyttet, siden
   Airbnb henter den uten innlogging — del den ikke offentlig.
2. **Airbnb → Lindeview**: lim inn Airbnbs egen eksport-URL (samme sted i
   Airbnb, «Eksporter kalender») i feltet under. Sjekkes automatisk én gang
   daglig (Vercel Cron, se [vercel.json](vercel.json): `/api/cron/calendar-sync`)
   og vises som blokkerte datoer i admin-kalenderen, tydelig merket som
   «Airbnb-reservasjon» og uten mulighet for å fjerne dem manuelt (de
   erstattes ved neste synk).

   Cron-jobber hyppigere enn én gang i døgnet krever Vercel Pro og feiler
   deployen med en tydelig feilmelding på Hobby-planen — la `schedule` i
   [vercel.json](vercel.json) stå på én gang daglig med mindre dere har Pro.

Hvis en periode fra Airbnb overlapper med en allerede bekreftet booking her
(en reell dobbeltbooking), varsles eieren automatisk på e-post (krever at
Resend er satt opp, se under). Ingen nye miljøvariabler kreves — begge
URL-ene lagres på admin-kontoen, ikke i env.

### Nå — må settes for at admin skal virke

Legg til i `.env.local` lokalt, og i Vercel sine Environment Variables for
produksjon:

- `ADMIN_PASSWORD` — passordet du logger inn med på `/admin`. Fungerer alltid,
  selv etter at du har byttet passord under «Min konto» — et fast
  sikkerhetsnett siden det ikke finnes noen «glemt passord»-e-post.
- `ADMIN_SESSION_SECRET` — en lang, tilfeldig streng (f.eks.
  `openssl rand -hex 32`), brukes til å signere innloggingscookien.

### Min konto

`/admin/account` lar deg endre navn og e-post, og bytte passord (krever
gjeldende passord). Passordkrav: minst 10 tegn, minst 2 tall og minst 1
spesialtegn. Det nye passordet lagres i tillegg til `ADMIN_PASSWORD` — begge
fungerer for innlogging.

### Topartsverifisering (MFA)

Slås på under **Min konto → Topartsverifisering**: skann QR-koden med en
autentiseringsapp (Google Authenticator, Microsoft Authenticator, 1Password
o.l.) og bekreft med koden appen viser. Deretter krever innloggingen både
passord og en 6-sifret kode — også med `ADMIN_PASSWORD`.

- **Reservekoder:** 10 engangskoder vises *én gang* ved oppsett. Lagre dem
  i passordbehandleren. Brukes via «Har ikke telefonen? Bruk en
  reservekode» på innloggingen. Slå MFA av og på igjen for nye koder.
- **Slå av:** krever passord og en gyldig kode (eller reservekode).
- **Nødbryter:** mistet både telefon og reservekoder? Sett
  `ADMIN_MFA_DISABLED=true` i Vercel og redeploy — da holder passordet
  alene. Logg inn, slå MFA av og på igjen (ny QR-kode og nye
  reservekoder), og fjern variabelen.
- Etter 5 feil koder på et kvarter sperres kodeforsøk fra samme IP i et
  kvarter. Samme kode kan ikke brukes to ganger.

### E-post (Resend)

**Til eieren:** Eieren varsles på **ljoestad@gmail.com** (satt i [lib/property.ts](lib/property.ts) som
`OWNER_EMAIL`) hver gang noen sender en bookingforespørsel. Uten oppsett skjer
ingenting (forespørselen lagres og vises i `/admin` uansett) — for å faktisk
sende e-post:

1. Opprett en konto på [resend.com](https://resend.com) — bruk **ljoestad@gmail.com**
   som kontoens e-post. Da kan du sende uten å verifisere et eget domene
   (Resend sin gratis sandkasse tillater sending til kontoens egen adresse).
2. Lag en API-nøkkel (**API Keys** → **Create API Key**).
3. Sett i miljøvariablene: `RESEND_API_KEY`.
4. (Valgfritt, krever verifisert domene) `RESEND_FROM_EMAIL` for å sende fra
   f.eks. `Lindeview <booking@lindeview.no>` i stedet for standard
   `onboarding@resend.dev`.
5. **Hvem som varsles om nye bookingforespørsler** styres i `/admin` →
   «Min konto» → **«Brukere som får varsling»**: legg til adresser, skru
   varselet av/på per adresse med bryteren, eller fjern dem. Bare det
   varselet, ikke betalingsfeil, avbestillinger o.l., som går til eieren. Hver
   mottaker får sin egen e-post. Andre enn eieren krever `RESEND_FROM_EMAIL`.
   Listen lagres i databasen, ikke i koden, fordi repoet er offentlig. Før
   listen er endret første gang, inneholder den eieren og adressene i den
   gamle miljøvariabelen `BOOKING_REQUEST_EXTRA_EMAILS` (kommaseparert); den
   kan fjernes etterpå.

**Til gjesten (på engelsk):**

1. *Booking approved* — sendes automatisk når du bekrefter en booking i
   `/admin`: datoer, prisoversikt, lenke for å betale forskuddet og sikre
   kortet (gyldig 24 t), hvor mye som trekkes når, depositum, og at endelig
   bekreftelse kommer når betalingen er mottatt.
2. *Booking confirmed* — sendes automatisk (én gang) når gjesten har betalt
   forskuddet via Stripe: forskudd mottatt, og når resten trekkes — eller at
   alt er betalt, ved sen booking.
2b. *Payment needed* — sendes automatisk når det automatiske trekket av
   resten feiler. Gjesten bes betale resten selv fra «Min booking». Du får
   samtidig e-post om betalingsfeilen, og bestemmer selv om bookingen skal
   avbestilles hvis ingenting skjer. Du får e-post når resten er betalt.
3. *Booking cancelled* — når du avbestiller en **bekreftet** booking, og
   *Booking request not confirmed* — når du **avslår en ny forespørsel**. Før
   du bekrefter, vises en avkrysning «Send e-post til gjesten» (på som
   standard) – skru den av hvis du allerede har snakket med gjesten.
   Avbestillings-e-posten åpner med «som du ba om» når gjesten tok
   initiativet, ellers «vi må dessverre avlyse», og sier hva som faktisk er
   refundert, eller at ingenting er trukket.

**Avslått eller avbestilt:** Tar du selv initiativet («Avslå» på en
forespørsel, «Avbestill» eller «Vi avlyser»), må du skrive en begrunnelse
(maks 200 tegn). Den står i e-posten til gjesten og på «Min booking», så
skriv den på engelsk hvis gjesten ikke leser norsk. Bookingen vises da som
**«Avslått»**. Har gjesten bedt om avbestilling (på «Min booking», eller du
velger «Gjesten avbestiller»), trengs ingen begrunnelse, og bookingen vises
som **«Avbestilt»**. Begrunnelsen er også med i CSV-eksporten.

Har lenken utløpt: trykk «Generer ny lenke» og deretter **«Send e-post til
gjest»** i betalingspanelet — ny lenke sender ikke e-post av seg selv. Admin
viser når e-postene ble sendt. Gjestens svar går til `OWNER_EMAIL`
(ljoestad@gmail.com) — lindeview.no tar ikke imot e-post, avsenderadressen
er bare et navn.

Gjeste-e-post krever et verifisert domene (sandkassen sender bare til
kontoens egen adresse):

1. Resend → **Domains → Add domain** → `lindeview.no` (region EU).
2. Legg inn DNS-postene Resend viser (CNAME på `send` og `rsend`, TXT på
   `resend._domainkey`) hos Domeneshop, og vent på «Verified». Se
   «Domene» over for gjeldende oppsett.
3. Sett `RESEND_FROM_EMAIL=Lindeview <booking@lindeview.no>` (i tillegg til
   `RESEND_API_KEY`) i Vercel og `.env.local`, og redeploy.

Uten `RESEND_FROM_EMAIL` sendes ingen gjeste-e-post — lenken vises i admin
som før, og eier-varslene virker som vanlig.

### Lagring av bookinger

Uten videre oppsett brukes en lokal fil (`.data/bookings.json`) — fin til
utvikling, men overlever ikke en ny deploy på Vercel. Før dere går live, sett
opp **Vercel KV** (Upstash Redis) fra Vercel-dashboardet under prosjektets
Storage-fane — det setter automatisk `KV_REST_API_URL` og
`KV_REST_API_TOKEN`, og appen bytter til Redis uten kodeendringer.

### Google Calendar (kobles til senere)

Bookinger fungerer helt uten dette — sett opp når dere er klare:

1. Opprett et prosjekt i [Google Cloud Console](https://console.cloud.google.com/), aktiver Calendar API.
2. Opprett en service-konto, last ned JSON-nøkkelen.
3. Del kalenderen du vil bruke med service-kontoens e-postadresse (Innstillinger for deling → gi tilgang til å endre hendelser).
4. Sett i miljøvariablene:
   - `GOOGLE_CALENDAR_ID` (kalenderens ID, finnes i kalenderinnstillingene)
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (hele `private_key`-verdien fra JSON-filen)

### Betaling (Stripe)

Alle priser er i **EUR**, og settes under «Priser» i admin. Betalingsflyten:

1. Du bekrefter en booking i `/admin` → en betalingslenke lages automatisk
   (Stripe Checkout). Lenken **sendes på e-post** til gjesten (se
   Resend-seksjonen over), og vises i admin.
2. Gjesten betaler **forskuddet, 25 % av leien** (`PREPAYMENT_SHARE`), og
   kortet lagres samtidig. Checkout ber alltid om **3D Secure** (BankID/
   bank-app), så banken og ikke du tar tapet hvis kortet var stjålet. 3D
   Secure er inkludert i Stripes standardpris. Ved sen bestilling (under 29
   dager til innsjekk) betales hele leien her.
3. **Resten** (75 %) trekkes automatisk 29 dager før innsjekk (dagen etter at
   fristen for gratis avbestilling er ute) fra det lagrede kortet. Feiler
   trekket (kortet avvist, eller banken krever ny godkjenning), settes
   betalingen til «feilet», du får e-post, og gjesten får e-post med lenke
   til å betale resten selv. Bookingen avbestilles ikke automatisk.
   Bookinger fra før forskudd fantes, trekker hele leien som før.
4. **Depositum** (standard 1000 EUR, beløpet låses på bookingen) reserveres automatisk på kortet **dagen
   før utsjekk** (ikke før innsjekk — et korthold varer bare ca. 7 dager
   hos de fleste banker, så det holdes til rett etter oppholdet i stedet for
   å strekke seg over hele det). Det frigis normalt innen 5 dager etter
   utsjekk: inspiser hytta og enten trekk (helt/delvis) eller frigi det i
   `/admin`. Ved trekk skriver du beløpet og en begrunnelse (maks 200 tegn),
   som vises i admin, i CSV-eksporten og som metadata på betalingen i Stripe.
   «Frigi depositum» kansellerer reservasjonen i Stripe; brukes den
   før noe er reservert, hoppes den automatiske reservasjonen over.
5. **Tilleggsbeløp** (skade, ekstra rengjøring) kan trekkes når som helst fra
   samme lagrede kort, også i `/admin`.
6. **Refusjon**: er noe trukket ved en feil, har forskuddet, resten, et trukket
   depositum og hvert tilleggsbeløp en «Refunder»-knapp i `/admin`. Velg
   beløp (helt eller delvis, flere ganger opp til det som er trukket) og skriv
   en begrunnelse (maks 200 tegn). Refusjonen vises under belastningen, telles
   i «Refundert» i CSV-eksporten og lagres som metadata i Stripe. Den kan
   ikke angres, pengene er hos gjesten etter ca. 5–10 dager, og Stripe-gebyret
   for den opprinnelige belastningen betales ikke tilbake. Avbestilling av en
   betalt booking refunderer automatisk og havner i samme logg.

En daglig jobb (Vercel Cron, se [vercel.json](vercel.json)) sjekker og
utfører belastninger som har forfalt. Alt kan også trigges manuelt fra
`/admin` (nyttig for sene bestillinger, eller hvis noe feiler og må prøves
på nytt).

**Oppsett i Stripe:**

1. Opprett konto på [stripe.com](https://dashboard.stripe.com/register) —
   start i **testmodus** (bryteren øverst til høyre i dashbordet).
2. **Developers → API keys** → kopier **Secret key**.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://<ditt-domene>/api/stripe/webhook`
   - Events: `checkout.session.completed`
   - Kopier **Signing secret** som vises etterpå.
4. Sett i miljøvariablene (samme sted som `ADMIN_PASSWORD`):
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `CRON_SECRET` — en vilkårlig, hemmelig streng du finner på (f.eks.
     `openssl rand -hex 32`); Vercel sender den automatisk til cron-jobben.
5. Redeploy.
6. **Test** i testmodus med testkort `4242 4242 4242 4242`, hvilken som helst
   fremtidig utløpsdato og CVC — hele flyten (forskudd → belastning av resten →
   depositum → tilleggsbeløp) kan kjøres uten ekte penger. `4000 0027 6000 3184`
   krever 3D Secure hver gang, og lar deg teste et feilet trekk av resten og
   «Betal resten». Bytt til
   live-nøkler (`sk_live_...`) og et nytt live-webhook-endepunkt når dere er
   klare for skarpe betalinger.

### Tillitssignaler for internasjonale gjester

Målgruppen booker langt unna eieren, så flere ting er lagt til for å bygge
tillit til at eieren er en reell person og hytta faktisk finnes:

- Ekte navn og mobilnummer i [Footer.tsx](components/Footer.tsx) (ikke
  placeholder-tekst — hold denne oppdatert hvis kontaktinfo endres).
- Et lite, innebygd Google Maps-kart i footeren (Lindeknuten,
  satellittvisning). Ingen API-nøkkel kreves for dette enkle embedet, men det
  har heller ingen målestokklinje å kalibrere zoom-nivå eksakt mot.
- Lenke til Airbnb-oppføringen i [Testimonials.tsx](components/Testimonials.tsx)
  — uavhengige, verifiserbare omtaler er et sterkt tillitssignal.
- «Sikker betaling via Stripe»-merke i
  [PaymentNotice.tsx](components/booking/PaymentNotice.tsx).

## Deploy

Prosjektet deployes automatisk til Vercel ved push til `main`. Miljøvariablene
som trengs, står i seksjonene over.

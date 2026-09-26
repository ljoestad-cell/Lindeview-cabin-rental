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
| Minst 30 dager før innsjekk | Alt (normalt er ingenting trukket ennå) |
| 14–29 dager før innsjekk | 50 % av leiebeløpet |
| Mindre enn 14 dager før | Ingenting |

For en betalt booking har admin to knapper. **«Gjesten avbestiller»**
refunderer etter tabellen over, og beløpet står på knappen. **«Vi avlyser»**
refunderer alt. Det som er refundert, vises på bookingen.

Admin kan ikke bekrefte en forespørsel som overlapper en allerede bekreftet
booking eller en blokkert periode. Det gir en feilmelding i stedet for
dobbeltbooking.

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

Tellerne ligger i samme lager som bookingene (Redis i produksjon, i minnet
lokalt). Grensene settes i [lib/rate-limit.ts](lib/rate-limit.ts).

### Søkemotorer og deling

`robots.txt`, `sitemap.xml`, et delingsbilde (`app/opengraph-image.jpg`) og
strukturerte data (schema.org `VacationRental`) genereres automatisk. Admin og
API er stengt for søkemotorer. Adressene bygges fra `NEXT_PUBLIC_SITE_URL`,
eller fra Vercels produksjons-URL hvis den ikke er satt. Sett
`NEXT_PUBLIC_SITE_URL` når siden får eget domene.

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
fungerer for innlogging. Siden har også en plassholder for
topartsverifisering (MFA) — ikke funksjonell ennå, men datamodellen
(`mfaEnabled`/`mfaSecret`) er klar for det.

### E-postvarsel om nye forespørsler

Eieren varsles på **ljoestad@gmail.com** (satt i [lib/property.ts](lib/property.ts) som
`OWNER_EMAIL`) hver gang noen sender en bookingforespørsel. Uten oppsett skjer
ingenting (forespørselen lagres og vises i `/admin` uansett) — for å faktisk
sende e-post:

1. Opprett en konto på [resend.com](https://resend.com) — bruk **ljoestad@gmail.com**
   som kontoens e-post. Da kan du sende uten å verifisere et eget domene
   (Resend sin gratis sandkasse tillater sending til kontoens egen adresse).
2. Lag en API-nøkkel (**API Keys** → **Create API Key**).
3. Sett i miljøvariablene: `RESEND_API_KEY`.
4. (Valgfritt, krever verifisert domene) `RESEND_FROM_EMAIL` for å sende fra
   f.eks. `Lindeview <post@lindeview.no>` i stedet for standard
   `onboarding@resend.dev`.

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

1. Du bekrefter en booking i `/admin` → en secure-card-lenke lages automatisk
   (Stripe Checkout, "sikre kort"-modus — ingen belastning). Lenken **vises i
   admin** for deg å sende til gjesten (SMS/e-post) inntil gjeste-e-post er
   satt opp (se Resend-seksjonen over — krever et verifisert domene).
2. Gjesten fyller inn kortet sitt. Ingenting belastes ennå.
3. **Hovedbeløpet** (leie + utvask) trekkes automatisk 30 dager før innsjekk
   — eller med en gang, hvis bookingen ble bekreftet senere enn det.
4. **Depositum** (standard 1000 EUR, beløpet låses på bookingen) reserveres automatisk på kortet **på
   utsjekksdagen** (ikke før innsjekk — et korthold varer bare ca. 7 dager
   hos de fleste banker, så det holdes til rett etter oppholdet i stedet for
   å strekke seg over hele det). Du har deretter noen dager på deg til å
   inspisere hytta og enten trekke (helt/delvis) eller frigi det i `/admin`.
5. **Tilleggsbeløp** (skade, ekstra rengjøring) kan trekkes når som helst fra
   samme lagrede kort, også i `/admin`.

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
   fremtidig utløpsdato og CVC — hele flyten (sikre kort → belastning →
   depositum → tilleggsbeløp) kan kjøres uten ekte penger. Bytt til
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

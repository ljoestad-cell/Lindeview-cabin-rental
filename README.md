This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Booking & admin

Nettsiden har en bookingflyt (`/book`) og et admin-panel (`/admin`) for å
godkjenne/avslå forespørsler. Faste regler ligger i
[lib/config.ts](lib/config.ts) — pris, rengjøringsgebyr, sesong, minimum
opphold og prisen på tilleggene under.

### Tillegg som påvirker prisen

Gjesten velger antall (0 = ikke valgt) for tre tillegg på `/book`, fast pris
pr. booking (ikke pr. natt):

| Tillegg | Maks antall | Pris |
|---|---|---|
| Lading av el-bil | 4 | 60 EUR pr. bil |
| Kjæledyr | 4 | 60 EUR pr. dyr |
| Sengetøy & håndklær | 10 | 25 EUR pr. sett |

Bookingsiden viser også tydelig at hytta kun leies ut til familier, ikke
voksne grupper, firmaer eller arrangementer
([lib/config.ts](lib/config.ts): `FAMILY_ONLY_NOTICE`).

### Admin-kalender og datoblokkering

`/admin` har en kalender som viser bekreftede bookinger, ubehandlede
forespørsler og manuelt blokkerte perioder i én oversikt
([components/admin/AdminCalendar.tsx](components/admin/AdminCalendar.tsx)).
Eieren kan velge en ledig periode og blokkere den (eget bruk, vedlikehold
o.l.) med en valgfri årsak — blokkerte datoer telles automatisk med i
tilgjengeligheten på `/book`, så gjester ikke kan sende forespørsel for dem.

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

Eieren varsles på **ljoestad@gmail.com** (satt i [lib/config.ts](lib/config.ts) som
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

Alle priser er i **EUR** ([lib/config.ts](lib/config.ts)). Betalingsflyten:

1. Du bekrefter en booking i `/admin` → en secure-card-lenke lages automatisk
   (Stripe Checkout, "sikre kort"-modus — ingen belastning). Lenken **vises i
   admin** for deg å sende til gjesten (SMS/e-post) inntil gjeste-e-post er
   satt opp (se Resend-seksjonen over — krever et verifisert domene).
2. Gjesten fyller inn kortet sitt. Ingenting belastes ennå.
3. **Hovedbeløpet** (leie + utvask) trekkes automatisk 30 dager før innsjekk
   — eller med en gang, hvis bookingen ble bekreftet senere enn det.
4. **Depositum** (1000 EUR) reserveres automatisk på kortet **på
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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

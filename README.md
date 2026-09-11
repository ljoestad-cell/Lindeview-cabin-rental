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
[lib/config.ts](lib/config.ts) — pris, rengjøringsgebyr, sesong og minimum
opphold.

### Nå — må settes for at admin skal virke

Legg til i `.env.local` lokalt, og i Vercel sine Environment Variables for
produksjon:

- `ADMIN_PASSWORD` — passordet du logger inn med på `/admin`.
- `ADMIN_SESSION_SECRET` — en lang, tilfeldig streng (f.eks.
  `openssl rand -hex 32`), brukes til å signere innloggingscookien.

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

### Betaling (kommer senere)

Betalingssteget vises som en tydelig plassholder i bookingskjemaet
([components/booking/PaymentNotice.tsx](components/booking/PaymentNotice.tsx)).
Selve integrasjonen kobles inn i [lib/payments.ts](lib/payments.ts) og
webhook-ruten [app/api/payments/webhook/route.ts](app/api/payments/webhook/route.ts)
når en leverandør (Stripe, Vipps o.l.) er valgt.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

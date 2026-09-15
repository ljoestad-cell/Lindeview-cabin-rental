@AGENTS.md

# Lindeview — prosjektnotater

Nettside + bookingløsning for en hytteutleie (Hillestadheia). Gjester sender
bookingforespørsler på `/book`, eieren godkjenner/avslår og styrer alt i
`/admin` (passordbeskyttet). Betaling, depositum og tilleggsbeløp går via
Stripe. Se `private-docs/Lindeview-teknisk-dokumentasjon.pdf` for en full
gjennomgang av arkitektur og tredjepartsvalg.

## Arkitektur

- `app/` — sider (`/`, `/book`, `/admin`, `/admin/account`) og API-ruter
  (`app/api/**/route.ts`).
- `components/` — UI. `components/booking/` hører til gjestesiden,
  `components/admin/` til admin-panelet, resten er forsiden.
- `lib/` — all forretningslogikk, ingen UI. Start i `lib/config.ts` (faste
  regler: priser, sesong, grenser — aldri hardkod disse tallene andre
  steder) og `lib/bookings.ts` (kjerneflyten for booking/betaling/blokkering).

## Tredjepartsstatus (kan endre seg — sjekk før du antar)

- **Stripe**: koblet til, kjører i testmodus.
- **Resend**: sender kun til eierens egen e-post (sandkasse, ikke
  domeneverifisert) — gjeste-e-post er ikke automatisert ennå.
- **Google Calendar**: kode klar, ikke koblet til (venter på at eieren
  oppretter service-konto).
- **MFA**: datamodell og UI-plassholder finnes i "Min konto", ingen faktisk
  funksjonalitet.

## Arbeidsvaner i dette prosjektet

- Før commit: `npx tsc --noEmit`, `npx eslint .`, `npm run build` — alle skal
  være rene. Ved UI-endringer: verifiser visuelt i nettleser (Playwright mot
  den lokale dev-serveren) før du sier noe er ferdig.
- Commit-meldinger på norsk, forklarer hva og hvorfor, avsluttes med
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Rydd testdata (`.data/*.json`) og midlertidige Playwright-mapper etter
  verifisering, før commit.
- Spør før du committer/pusher kun ved store/arkitektoniske endringer — små,
  presise endringer (tekst, styling, ett felt) committes fortløpende uten å
  spørre først, med mindre brukeren ber om noe annet.
- Hold README.md oppdatert når en bruker-synlig funksjon eller et nytt
  oppsettsteg legges til — den er den reelle driftsdokumentasjonen.

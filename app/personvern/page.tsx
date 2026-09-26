import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/LegalPage";
import { RETENTION_MONTHS_CONFIRMED, RETENTION_MONTHS_OTHER, TERMS_VERSION } from "@/lib/config";
import { CONTACT_EMAIL, OWNER_NAME, OWNER_PHONE_DISPLAY, PROPERTY_NAME } from "@/lib/property";

export const metadata: Metadata = {
  title: `Personvern | ${PROPERTY_NAME}`,
  description: `Hvordan ${PROPERTY_NAME} behandler personopplysninger ved booking.`,
};

/** Oppbevaringstidene hentes fra lib/config.ts og håndheves av anonymizeExpiredBookings() i lib/bookings.ts. */
export default function PrivacyPage() {
  const confirmedYears = RETENTION_MONTHS_CONFIRMED / 12;
  return (
    <LegalPage eyebrow="Personvern" title="Personvernerklæring" updated={TERMS_VERSION}>
      <LegalSection title="Behandlingsansvarlig">
        <p>
          {OWNER_NAME} er ansvarlig for behandlingen av personopplysninger på denne nettsiden. Kontakt: {CONTACT_EMAIL},{" "}
          {OWNER_PHONE_DISPLAY}.
        </p>
      </LegalSection>

      <LegalSection title="Hva vi samler inn">
        <ul>
          <li>Navn, e-postadresse og telefonnummer.</li>
          <li>Datoer, antall gjester, valgte tillegg og eventuell melding til oss.</li>
          <li>
            Betalingsinformasjon. Kortopplysninger registreres direkte hos Stripe. Vi ser og lagrer aldri
            kortnummeret, bare en referanse til kortet.
          </li>
        </ul>
        <p>Nettsiden bruker ingen analyse- eller reklamecookies. Admin-innloggingen bruker én nødvendig cookie.</p>
      </LegalSection>

      <LegalSection title="Hvorfor, og med hvilket grunnlag">
        <p>
          Opplysningene brukes til å behandle bookingforespørselen, kontakte deg om oppholdet og ta betalt,
          inkludert depositum og eventuelle tilleggsbeløp. Grunnlaget er at behandlingen er nødvendig for å inngå og
          oppfylle leieavtalen (personvernforordningen art. 6 nr. 1 bokstav b), og for å oppfylle
          regnskapsplikten (bokstav c).
        </p>
      </LegalSection>

      <LegalSection title="Hvem vi deler med">
        <ul>
          <li>
            <strong>Stripe</strong>: betaling og depositum.
          </li>
          <li>
            <strong>Vercel</strong> og <strong>Upstash</strong>: drift av nettsiden og databasen der bookingene
            lagres.
          </li>
          <li>
            <strong>Resend</strong>: utsending av e-postvarsler om bookinger.
          </li>
          <li>
            <strong>Airbnb</strong>: bare hvilke datoer som er opptatt, merket «Reservert». Airbnb får ikke navn
            eller kontaktinfo.
          </li>
          <li>
            <strong>Google</strong>: kartet nederst på siden lastes fra Google Maps.
          </li>
        </ul>
        <p>Opplysningene selges aldri og brukes ikke til markedsføring.</p>
      </LegalSection>

      <LegalSection title="Hvor lenge vi lagrer">
        <ul>
          <li>
            <strong>Gjennomførte bookinger:</strong> {confirmedYears} år etter utsjekk, på grunn av bokføringsloven.
          </li>
          <li>
            <strong>Forespørsler som ikke ble noe av:</strong> {RETENTION_MONTHS_OTHER} måneder etter de ønskede
            datoene.
          </li>
        </ul>
        <p>
          Deretter slettes navn, e-post, telefon og melding automatisk. Bare datoer og beløp beholdes, og de kan
          ikke knyttes til deg.
        </p>
      </LegalSection>

      <LegalSection title="Dine rettigheter">
        <p>
          Du kan be om innsyn i, retting av eller sletting av opplysningene dine, og protestere mot behandlingen.
          Kontakt oss på {CONTACT_EMAIL}. Er du misfornøyd med hvordan vi behandler opplysningene dine, kan du klage
          til Datatilsynet (datatilsynet.no).
        </p>
      </LegalSection>
    </LegalPage>
  );
}

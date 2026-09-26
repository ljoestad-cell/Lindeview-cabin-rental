import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection } from "@/components/LegalPage";
import {
  CHARGE_DAYS_BEFORE_CHECKIN,
  DEPOSIT_HOLD_DAYS,
  FULL_REFUND_DAYS,
  MAX_GUESTS,
  MIN_NIGHTS,
  PARTIAL_REFUND_DAYS,
  PARTIAL_REFUND_SHARE,
  TERMS_VERSION,
} from "@/lib/config";
import { CONTACT_EMAIL, LOCATION_LABEL, OWNER_NAME, OWNER_PHONE_DISPLAY, PROPERTY_NAME } from "@/lib/property";

export const metadata: Metadata = {
  title: `Leievilkår | ${PROPERTY_NAME}`,
  description: `Vilkår for leie av ${PROPERTY_NAME}: betaling, depositum og avbestilling.`,
};

/**
 * Leievilkårene gjesten godtar på /book. Tallene hentes fra lib/config.ts, så
 * teksten følger reglene koden faktisk håndhever. Endres innholdet her, øk
 * TERMS_VERSION – versjonen lagres på hver booking.
 */
export default function TermsPage() {
  const partialPercent = Math.round(PARTIAL_REFUND_SHARE * 100);
  return (
    <LegalPage eyebrow="Vilkår" title="Leievilkår" updated={TERMS_VERSION}>
      <LegalSection title="1. Avtalen">
        <p>
          Disse vilkårene gjelder leie av {PROPERTY_NAME} på {LOCATION_LABEL}. Utleier er {OWNER_NAME}. En
          bookingforespørsel er ikke bindende for noen av partene før utleier har bekreftet den. Avtalen er inngått
          når du har fått bekreftelsen.
        </p>
      </LegalSection>

      <LegalSection title="2. Hvem vi leier ut til">
        <ul>
          <li>{PROPERTY_NAME} leies kun ut til familier, ikke til voksne grupper, firmaer eller arrangementer.</li>
          <li>Maks {MAX_GUESTS} gjester, og minimum {MIN_NIGHTS} netter per opphold.</li>
          <li>Kjæledyr må oppgis ved bestilling (tillegg).</li>
          <li>Den som sender forespørselen må være over 18 år og være til stede under oppholdet.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Pris og betaling">
        <p>
          Prisen du ser når du sender forespørselen er den som gjelder for bookingen, også om prisene endres senere.
          Alle beløp er i euro (EUR).
        </p>
        <p>
          Når bookingen er bekreftet, får du en lenke for å registrere et betalingskort hos Stripe. Ingenting trekkes
          da. <strong>Hele leiebeløpet trekkes automatisk {CHARGE_DAYS_BEFORE_CHECKIN} dager før innsjekk</strong>,
          eller med en gang hvis bookingen bekreftes senere enn det. Vi ser eller lagrer aldri kortnummeret ditt.
        </p>
      </LegalSection>

      <LegalSection title="4. Depositum">
        <p>
          Depositumet som ble oppgitt da du bestilte, reserveres på kortet ditt på utsjekksdagen. Det trekkes ikke,
          og det frigis normalt innen {DEPOSIT_HOLD_DAYS} dager etter at vi har sett over hytta.
        </p>
        <p>
          Depositumet kan helt eller delvis trekkes ved skade, tap, uvanlig behov for rengjøring eller brudd på
          disse vilkårene. Du får i så fall beskjed om årsaken og beløpet.
        </p>
      </LegalSection>

      <LegalSection title="5. Skade og tilleggsbeløp">
        <p>
          Du er ansvarlig for skade som du eller følget ditt påfører hytta, inventaret eller eiendommen. Overstiger
          skaden depositumet, eller oppdages den etter at depositumet er frigitt, kan vi trekke et tilleggsbeløp fra
          det samme kortet. Du får beskjed og dokumentasjon før det skjer.
        </p>
      </LegalSection>

      <LegalSection title="6. Avbestilling fra deg">
        <p>Avbestill ved å kontakte oss på e-post eller telefon. Refusjonen avhenger av når vi får beskjed:</p>
        <ul>
          <li>
            <strong>Minst {FULL_REFUND_DAYS} dager før innsjekk:</strong> gratis avbestilling. Normalt er ingenting
            trukket ennå.
          </li>
          <li>
            <strong>
              {PARTIAL_REFUND_DAYS}–{FULL_REFUND_DAYS - 1} dager før innsjekk:
            </strong>{" "}
            {partialPercent} % av leiebeløpet refunderes.
          </li>
          <li>
            <strong>Mindre enn {PARTIAL_REFUND_DAYS} dager før innsjekk:</strong> ingen refusjon.
          </li>
        </ul>
        <p>Refusjon går tilbake til samme kort. Et depositum som ikke er reservert, trekkes ikke.</p>
      </LegalSection>

      <LegalSection title="7. Avlysning fra oss">
        <p>
          Må vi avlyse oppholdet, for eksempel på grunn av skade på hytta eller andre forhold vi ikke rår over, får du
          hele det innbetalte beløpet tilbake.
        </p>
      </LegalSection>

      <LegalSection title="8. Under oppholdet">
        <p>
          Behandle hytta og naturen rundt med omtanke, og følg husreglene som ligger i hytta. Antall gjester og
          kjæledyr må ikke overstige det som er avtalt.
        </p>
      </LegalSection>

      <LegalSection title="9. Personopplysninger">
        <p>
          Hvordan vi behandler opplysningene dine står i{" "}
          <Link href="/personvern" className="font-medium text-accent underline">
            personvernerklæringen
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="10. Kontakt og lovvalg">
        <p>
          Spørsmål eller avbestilling: {OWNER_NAME}, {CONTACT_EMAIL}, {OWNER_PHONE_DISPLAY}. Avtalen følger norsk
          rett.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

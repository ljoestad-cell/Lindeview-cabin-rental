import { OWNER_EMAIL } from "@/lib/config";
import { formatNok } from "@/lib/pricing";
import type { Booking } from "@/lib/types";

/**
 * Sender e-postvarsel til eieren når en ny bookingforespørsel kommer inn.
 * Bruker Resend sitt REST-API (ingen SDK-avhengighet nødvendig).
 *
 * Uten RESEND_API_KEY gjør funksjonen ingenting (logger og returnerer) –
 * bookingen lagres og vises i /admin uansett, akkurat som med kalender og
 * betaling. Koble til senere ved å opprette en konto på resend.com (helst
 * med ljoestad@gmail.com, se README) og sette miljøvariabelen.
 */

const RESEND_API = "https://api.resend.com/emails";

let warnedOnce = false;
function warnNotConfigured() {
  if (warnedOnce) return;
  warnedOnce = true;
  console.info(
    "[notifications] RESEND_API_KEY mangler – sender ikke e-postvarsel om nye bookingforespørsler. Se README for oppsett.",
  );
}

function buildEmailBody(booking: Booking): string {
  const lines = [
    `${booking.name} har sendt en bookingforespørsel for Lindeview.`,
    "",
    `Innsjekk:  ${booking.checkIn}`,
    `Utsjekk:   ${booking.checkOut}`,
    `Netter:    ${booking.nights}`,
    `Gjester:   ${booking.guests}`,
    `Totalt:    ${formatNok(booking.pricing.total)}`,
    "",
    `Navn:      ${booking.name}`,
    `E-post:    ${booking.email}`,
    `Telefon:   ${booking.phone}`,
  ];
  if (booking.message) {
    lines.push("", "Melding:", booking.message);
  }
  lines.push("", "Logg inn på /admin på nettsiden for å bekrefte eller avslå.");
  return lines.join("\n");
}

/** Best-effort – kaster videre ved feil, kalleren fanger og logger. */
export async function notifyOwnerOfBooking(booking: Booking): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    warnNotConfigured();
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "Lindeview <onboarding@resend.dev>";

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: OWNER_EMAIL,
      reply_to: booking.email,
      subject: `Ny bookingforespørsel: ${booking.checkIn} – ${booking.checkOut}`,
      text: buildEmailBody(booking),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend svarte ${res.status}: ${body}`);
  }
}

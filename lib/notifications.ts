import { OWNER_EMAIL } from "@/lib/config";
import type { Booking } from "@/lib/types";

/**
 * Sender korte varsler til eieren (nye forespørsler, betalingsproblemer) –
 * bare det viktigste, ikke alle detaljene (de finnes uansett i
 * admin-panelet). Bruker Resend sitt REST-API (ingen SDK-avhengighet
 * nødvendig).
 *
 * Uten RESEND_API_KEY gjør funksjonene ingenting (logger og returnerer) –
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
    "[notifications] RESEND_API_KEY mangler – sender ikke e-postvarsel til eieren. Se README for oppsett.",
  );
}

async function sendOwnerEmail(subject: string, text: string, replyTo?: string): Promise<void> {
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
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend svarte ${res.status}: ${body}`);
  }
}

/** Best-effort – kaster videre ved feil, kalleren fanger og logger. */
export async function notifyOwnerOfBooking(booking: Booking): Promise<void> {
  const text = [
    `Du har fått en ny bookingforespørsel på Lindeview.`,
    `${booking.name}, ${booking.checkIn} – ${booking.checkOut} (${booking.nights} netter).`,
    ``,
    `Logg inn på /admin for å se detaljene og svare.`,
  ].join("\n");

  await sendOwnerEmail(`Ny bookingforespørsel: ${booking.checkIn} – ${booking.checkOut}`, text, booking.email);
}

/**
 * Varsler eieren når en automatisk betaling eller depositum-reservasjon
 * feiler – f.eks. kort utløpt, avslått eller krever ny autentisering.
 * Best-effort, samme mønster som notifyOwnerOfBooking.
 */
export async function notifyOwnerOfPaymentIssue(booking: Booking, message: string): Promise<void> {
  const text = [
    `Et betalingsforsøk feilet for en booking på Lindeview.`,
    `${booking.name}, ${booking.checkIn} – ${booking.checkOut}.`,
    ``,
    `Feilmelding: ${message}`,
    ``,
    `Logg inn på /admin for å se status og prøve på nytt.`,
  ].join("\n");

  await sendOwnerEmail(`Betaling feilet: ${booking.name} (${booking.checkIn})`, text, booking.email);
}

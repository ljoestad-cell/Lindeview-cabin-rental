import { CHARGE_DAYS_BEFORE_CHECKIN, DEPOSIT_HOLD_DAYS } from "@/lib/config";
import { addDays, fromIso, today } from "@/lib/dates";
import { OWNER_EMAIL, OWNER_NAME, OWNER_PHONE_DISPLAY, PROPERTY_NAME } from "@/lib/property";
import { siteUrl } from "@/lib/site";
import type { Booking } from "@/lib/types";

/**
 * E-post via Resend sitt REST-API (ingen SDK-avhengighet nødvendig):
 *
 * - Korte varsler til eieren (nye forespørsler, betalingsproblemer) – bare
 *   det viktigste, detaljene finnes uansett i admin-panelet.
 * - Bookinge-post til gjesten (godkjent + betalingslenke, og bekreftelse når
 *   kortet er sikret). På engelsk, siden mange gjester er utenlandske.
 *
 * Uten RESEND_API_KEY gjør funksjonene ingenting (logger og returnerer) –
 * bookingen lagres og vises i /admin uansett. Gjeste-e-post krever i tillegg
 * RESEND_FROM_EMAIL på et domene som er verifisert i Resend: sandkasse-
 * avsenderen onboarding@resend.dev kan bare sende til kontoens egen adresse.
 * Se README for oppsett.
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

let warnedGuestOnce = false;
function warnGuestNotConfigured() {
  if (warnedGuestOnce) return;
  warnedGuestOnce = true;
  console.info(
    "[notifications] RESEND_API_KEY/RESEND_FROM_EMAIL mangler – sender ikke e-post til gjesten. Se README for oppsett.",
  );
}

/** Gjeste-e-post krever en verifisert avsender – sandkassen kan bare sende til eieren selv. */
export function guestEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

type EmailMessage = { to: string; subject: string; text: string; html?: string; replyTo?: string };

async function sendEmail(apiKey: string, { to, subject, text, html, replyTo }: EmailMessage): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL ?? `${PROPERTY_NAME} <onboarding@resend.dev>`;

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend svarte ${res.status}: ${body}`);
  }
}

async function sendOwnerEmail(subject: string, text: string, replyTo?: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    warnNotConfigured();
    return;
  }
  await sendEmail(apiKey, { to: OWNER_EMAIL, subject, text, replyTo });
}

/** Returnerer false (uten å kaste) hvis gjeste-e-post ikke er satt opp eller gjesten mangler adresse. */
async function sendGuestEmail(booking: Booking, email: GuestEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !process.env.RESEND_FROM_EMAIL) {
    warnGuestNotConfigured();
    return false;
  }
  if (!booking.email) return false;
  // Svar går rett til eierens innboks – lindeview.no har ingen innkommende e-post.
  await sendEmail(apiKey, { to: booking.email, replyTo: OWNER_EMAIL, ...email });
  return true;
}

/** Best-effort – kaster videre ved feil, kalleren fanger og logger. */
export async function notifyOwnerOfBooking(booking: Booking): Promise<void> {
  const text = [
    `Du har fått en ny bookingforespørsel på ${PROPERTY_NAME}.`,
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
    `Et betalingsforsøk feilet for en booking på ${PROPERTY_NAME}.`,
    `${booking.name}, ${booking.checkIn} – ${booking.checkOut}.`,
    ``,
    `Feilmelding: ${message}`,
    ``,
    `Logg inn på /admin for å se status og prøve på nytt.`,
  ].join("\n");

  await sendOwnerEmail(`Betaling feilet: ${booking.name} (${booking.checkIn})`, text, booking.email);
}

/**
 * Varsler eieren når Airbnb-kalendersynken finner en periode som overlapper
 * med en allerede bekreftet booking – et tegn på at samme datoer kan være
 * booket begge steder. Best-effort, samme mønster som de andre varslene.
 */
export async function notifyOwnerOfDoubleBooking(overlaps: string): Promise<void> {
  const text = [
    `OBS: Airbnb-kalendersynk fant periode(r) som overlapper med en bekreftet booking på ${PROPERTY_NAME}.`,
    ``,
    overlaps,
    ``,
    `Sjekk /admin så snart som mulig og kontakt riktig gjest før dette blir en reell dobbeltbooking.`,
  ].join("\n");

  await sendOwnerEmail("Mulig dobbeltbooking oppdaget (Airbnb-synk)", text);
}

// --- E-post til gjesten -------------------------------------------------

export type GuestEmail = { subject: string; text: string; html: string };

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const longDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatAmount(amount: number): string {
  return eur.format(amount);
}

function formatDate(iso: string): string {
  return longDate.format(fromIso(iso));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Prislinjer som [etikett, beløp] – tillegg tas bare med når de er valgt. */
function priceLines(booking: Booking): [string, string][] {
  const p = booking.pricing;
  const lines: [string, string][] = [
    [`${p.nights} nights × ${formatAmount(p.nightlyRate)}`, formatAmount(p.nightsTotal)],
    ["Cleaning", formatAmount(p.cleaningFee)],
  ];
  if (p.evChargerTotal > 0) lines.push([`EV charging (${p.extras.evChargers})`, formatAmount(p.evChargerTotal)]);
  if (p.petTotal > 0) lines.push([`Pets (${p.extras.pets})`, formatAmount(p.petTotal)]);
  if (p.beddingTotal > 0) lines.push([`Bed linen & towels (${p.extras.bedding} sets)`, formatAmount(p.beddingTotal)]);
  return lines;
}

function stayLines(booking: Booking): [string, string][] {
  return [
    ["Check-in", formatDate(booking.checkIn)],
    ["Check-out", formatDate(booking.checkOut)],
    ["Guests", String(booking.guests)],
  ];
}

function depositSentence(booking: Booking): string {
  return (
    `A security deposit of ${formatAmount(booking.deposit.amount)} will be reserved (not charged) on the same card ` +
    `on your check-out day, and released after we have inspected the cabin – normally within ${DEPOSIT_HOLD_DAYS} days.`
  );
}

function signatureLines(): string[] {
  return [
    `Questions? Just reply to this email, or call ${OWNER_PHONE_DISPLAY}.`,
    ``,
    `Best regards,`,
    `${OWNER_NAME}, ${PROPERTY_NAME}`,
  ];
}

// Enkel, inline-stylet HTML – e-postklienter ignorerer det meste av <style> og eksterne ark.
const FONT = "font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#23261f;";

function htmlTable(rows: [string, string][], { boldLast = false, alignRight = false } = {}): string {
  const cells = rows
    .map(([label, value], i) => {
      const weight = boldLast && i === rows.length - 1 ? "font-weight:600;" : "";
      return (
        `<tr><td style="padding:4px 16px 4px 0;${weight}">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0;text-align:${alignRight ? "right" : "left"};${weight}">${escapeHtml(value)}</td></tr>`
      );
    })
    .join("");
  return `<table style="border-collapse:collapse;margin:8px 0 16px;${FONT}">${cells}</table>`;
}

function htmlParagraphs(lines: string[]): string {
  return lines
    .join("\n")
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 12px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function htmlDocument(body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;${FONT}font-size:15px;line-height:1.5;">${body}</body></html>`;
}

function textTable(rows: [string, string][]): string[] {
  return rows.map(([label, value]) => `${label}: ${value}`);
}

/** E-post 1: eieren har godkjent – gjesten sikrer kortet via lenken. Ren funksjon, testbar uten nettverk. */
export function buildApprovalEmail(booking: Booking, now: string = today()): GuestEmail {
  const url = booking.secureCardUrl ?? "";
  const total = formatAmount(booking.pricing.total);
  const dueDate = addDays(booking.checkIn, -CHARGE_DAYS_BEFORE_CHECKIN);
  const chargeSentence =
    dueDate <= now
      ? `Since your stay is less than ${CHARGE_DAYS_BEFORE_CHECKIN} days away, the total of ${total} will be charged as soon as your card is secured.`
      : `Nothing is charged now. The total of ${total} will be charged automatically on ${formatDate(dueDate)} (${CHARGE_DAYS_BEFORE_CHECKIN} days before check-in).`;
  const termsUrl = `${siteUrl()}/vilkar`;

  const prices: [string, string][] = [...priceLines(booking), ["Total", total]];
  const intro = [
    `Hi ${booking.name},`,
    ``,
    `Good news – your booking request for ${PROPERTY_NAME} has been approved.`,
    ``,
    `To complete the booking, please secure your payment card using the link below. The link is valid for 24 hours – if it expires, just reply to this email and we will send you a new one.`,
  ];
  const plan = [
    `How payment works`,
    chargeSentence,
    depositSentence(booking),
    ``,
    `You will receive a final confirmation as soon as your payment method has been verified.`,
    ``,
    `Rental terms and cancellation policy: ${termsUrl}`,
  ];

  const text = [
    ...intro,
    ``,
    `Secure your card: ${url}`,
    ``,
    ...textTable(stayLines(booking)),
    ``,
    ...textTable(prices),
    ``,
    ...plan,
    ``,
    ...signatureLines(),
  ].join("\n");

  const button =
    `<p style="margin:20px 0;"><a href="${escapeHtml(url)}" ` +
    `style="display:inline-block;background:#26362a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">` +
    `Secure your card</a></p>`;

  const html = htmlDocument(
    htmlParagraphs(intro) +
      button +
      htmlTable(stayLines(booking)) +
      htmlTable(prices, { boldLast: true, alignRight: true }) +
      `<p style="margin:16px 0 6px;font-weight:600;">How payment works</p>` +
      htmlParagraphs([chargeSentence, ``, depositSentence(booking), ``,
        `You will receive a final confirmation as soon as your payment method has been verified.`]) +
      `<p style="margin:0 0 12px;"><a href="${escapeHtml(termsUrl)}" style="color:#26362a;">Rental terms and cancellation policy</a></p>` +
      htmlParagraphs(signatureLines()),
  );

  return {
    subject: `Booking approved – please secure your payment (${PROPERTY_NAME}, ${formatDate(booking.checkIn)})`,
    text,
    html,
  };
}

/** E-post 2: kortet er sikret og bookingen bekreftet. Ren funksjon, testbar uten nettverk. */
export function buildConfirmationEmail(booking: Booking): GuestEmail {
  const total = formatAmount(booking.pricing.total);
  const chargeSentence =
    booking.mainCharge.status === "paid"
      ? `Your payment of ${total} has been received – thank you.`
      : `Your card has been registered. The total of ${total} will be charged automatically on ${formatDate(
          booking.mainCharge.chargeAt ?? addDays(booking.checkIn, -CHARGE_DAYS_BEFORE_CHECKIN),
        )}.`;

  const intro = [
    `Hi ${booking.name},`,
    ``,
    `Your booking at ${PROPERTY_NAME} is now confirmed. We look forward to welcoming you!`,
  ];
  const payment = [chargeSentence, ``, depositSentence(booking)];
  const rows: [string, string][] = [...stayLines(booking), ["Total", total]];

  const text = [
    ...intro,
    ``,
    ...textTable(rows),
    ``,
    ...payment,
    ``,
    `We will be in touch with arrival details closer to your stay.`,
    ``,
    ...signatureLines(),
  ].join("\n");

  const html = htmlDocument(
    htmlParagraphs(intro) +
      htmlTable(rows, { boldLast: true }) +
      htmlParagraphs([...payment, ``, `We will be in touch with arrival details closer to your stay.`]) +
      htmlParagraphs(signatureLines()),
  );

  return {
    subject: `Booking confirmed – ${PROPERTY_NAME}, ${formatDate(booking.checkIn)} – ${formatDate(booking.checkOut)}`,
    text,
    html,
  };
}

/** Kaster ved feil fra Resend. Returnerer false hvis gjeste-e-post ikke er satt opp. */
export async function notifyGuestOfApproval(booking: Booking): Promise<boolean> {
  if (!booking.secureCardUrl) return false;
  return sendGuestEmail(booking, buildApprovalEmail(booking));
}

/** Kaster ved feil fra Resend. Returnerer false hvis gjeste-e-post ikke er satt opp. */
export async function notifyGuestOfConfirmation(booking: Booking): Promise<boolean> {
  return sendGuestEmail(booking, buildConfirmationEmail(booking));
}

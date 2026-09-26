import { getStore } from "@/lib/store";
import type { Booking, BookingStatus, DepositStatus, MainChargeStatus } from "@/lib/types";

const STATUS_LABEL: Record<BookingStatus, string> = { pending: "Venter", confirmed: "Bekreftet", declined: "Avslått" };
const CHARGE_LABEL: Record<MainChargeStatus, string> = {
  not_saved: "Kort ikke sikret",
  card_saved: "Kort sikret",
  paid: "Betalt",
  failed: "Feilet",
};
const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  none: "Ikke reservert",
  held: "Reservert",
  captured: "Trukket",
  released: "Frigitt",
  failed: "Feilet",
};

/**
 * Sikkerhetskopi av alt som bare finnes i databasen (Redis): bookinger,
 * blokkeringer, priser og kontoinnstillinger. Passordhash og MFA-hemmelighet
 * tas aldri med – filen kan havne i en nedlastingsmappe eller e-post.
 */
export async function buildBackup() {
  const store = getStore();
  const [bookings, blockedRanges, prices, account] = await Promise.all([
    store.listBookings(),
    store.listBlockedRanges(),
    store.getPrices(),
    store.getAdminAccount(),
  ]);
  let safeAccount = null;
  if (account) {
    const { ...rest } = account;
    delete (rest as Partial<typeof account>).passwordHash;
    delete (rest as Partial<typeof account>).mfaSecret;
    safeAccount = rest;
  }
  return {
    format: "lindeview-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    bookings: [...bookings].sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    blockedRanges,
    prices,
    account: safeAccount,
  };
}

const CSV_COLUMNS: [string, (b: Booking) => string | number | null][] = [
  ["Status", (b) => STATUS_LABEL[b.status] ?? b.status],
  ["Innsjekk", (b) => b.checkIn],
  ["Utsjekk", (b) => b.checkOut],
  ["Netter", (b) => b.nights],
  ["Gjester", (b) => b.guests],
  ["Navn", (b) => b.name],
  ["E-post", (b) => b.email],
  ["Telefon", (b) => b.phone],
  ["Totalt (EUR)", (b) => b.pricing.total],
  ["Betaling", (b) => (b.mainCharge ? CHARGE_LABEL[b.mainCharge.status] : null)],
  ["Betalt dato", (b) => b.mainCharge?.paidAt?.slice(0, 10) ?? null],
  ["Refundert (EUR)", (b) => b.mainCharge?.refundedAmount ?? null],
  ["Depositum", (b) => (b.deposit ? DEPOSIT_LABEL[b.deposit.status] : null)],
  ["Trukket depositum (EUR)", (b) => b.deposit?.capturedAmount ?? null],
  ["Tilleggsbeløp (EUR)", (b) =>
    (b.extraCharges ?? []).filter((c) => c.status === "succeeded").reduce((sum, c) => sum + c.amount, 0)],
  ["Opprettet", (b) => b.createdAt.slice(0, 10)],
  ["Id", (b) => b.id],
];

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  // Norsk Excel: desimalkomma, og semikolon som skilletegn (se bookingsToCsv).
  const text = typeof value === "number" ? String(value).replace(".", ",") : value;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Bookingene som CSV for regneark og regnskap. Semikolon-separert med
 * UTF-8-BOM, så norsk Excel åpner den riktig (kolonner og æøå) med dobbeltklikk.
 */
export function bookingsToCsv(bookings: Booking[]): string {
  const header = CSV_COLUMNS.map(([title]) => csvCell(title)).join(";");
  const rows = [...bookings]
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .map((b) => CSV_COLUMNS.map(([, get]) => csvCell(get(b))).join(";"));
  return "﻿" + [header, ...rows].join("\r\n") + "\r\n";
}

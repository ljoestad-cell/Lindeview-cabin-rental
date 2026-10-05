import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GuestBookingActions from "@/components/booking/GuestBookingActions";
import { PriceBreakdown } from "@/components/booking/PriceSummary";
import { getBookingByGuestToken } from "@/lib/bookings";
import { DEPOSIT_HOLD_DAYS } from "@/lib/config";
import { formatDateLong, today } from "@/lib/dates";
import { canRequestCancellation, canUpdateCard, freeCancellationDeadline, guestStatusLabel } from "@/lib/guest";
import { formatEur } from "@/lib/pricing";
import { CONTACT_EMAIL, OWNER_PHONE_DISPLAY, OWNER_PHONE_TEL, PROPERTY_NAME } from "@/lib/property";
import { isBlocked, recordFailure } from "@/lib/rate-limit";
import { cancelledByGuest } from "@/lib/status";
import type { Booking } from "@/lib/types";

// Token i URL-en er hemmelig: ikke indekser siden, og ikke send den videre som referrer.
export const metadata: Metadata = {
  title: `Din booking | ${PROPERTY_NAME}`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

/**
 * Gjestens «Min booking»-side – nås bare via den hemmelige lenken i
 * gjeste-e-postene (eller kvitteringen etter innsendt forespørsel). Ingen
 * innlogging: token er ugjettbar, og ukjente tokens telles mot rate limit.
 */
export default async function GuestBookingPage(props: PageProps<"/booking/[token]">) {
  const { token } = await props.params;
  const request = { headers: await headers() };
  if (await isBlocked("guestToken", request)) notFound();

  const booking = await getBookingByGuestToken(token);
  if (!booking) {
    await recordFailure("guestToken", request);
    notFound();
  }

  const now = today();
  const deadline = freeCancellationDeadline(booking.checkIn);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-20 sm:px-10 sm:py-28">
          <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Din booking</h1>
          <span className={`mt-4 inline-block rounded-full px-3 py-1 text-sm font-semibold ${statusStyle(booking)}`}>
            {guestStatusLabel(booking)}
          </span>

          <div className="mt-10 space-y-6">
            <Card title="Oppholdet">
              <dl className="space-y-2 text-sm">
                <Row label="Innsjekk" value={formatDateLong(booking.checkIn)} />
                <Row label="Utsjekk" value={formatDateLong(booking.checkOut)} />
                <Row label="Gjester" value={String(booking.guests)} />
              </dl>
            </Card>

            <PriceBreakdown quote={booking.pricing} />

            <Card title="Betaling">
              <PaymentStatus booking={booking} />
            </Card>

            <Card title="Avbestilling">
              <div className="space-y-3 text-sm text-muted">
                {booking.status === "declined" ? (
                  <>
                    <p>
                      {cancelledByGuest(booking)
                        ? "Bookingen er avbestilt, slik du ba om."
                        : "Vi har dessverre måttet avslå eller avbestille bookingen."}
                    </p>
                    {!cancelledByGuest(booking) && booking.declineReason && (
                      <p>
                        Begrunnelse: <span className="text-foreground">{booking.declineReason}</span>
                      </p>
                    )}
                  </>
                ) : now <= deadline ? (
                  <p>
                    Gratis avbestilling til og med <span className="font-medium text-foreground">{formatDateLong(deadline)}</span>.
                    Etter det refunderes ikke leien.
                  </p>
                ) : (
                  <p>Fristen for gratis avbestilling ({formatDateLong(deadline)}) er passert.</p>
                )}
                <p>
                  Se{" "}
                  <Link href="/vilkar" className="text-accent underline">
                    leievilkårene
                  </Link>{" "}
                  for detaljer.
                </p>
              </div>
            </Card>

            <GuestBookingActions
              token={token}
              canUpdateCard={canUpdateCard(booking)}
              cardSaved={booking.mainCharge.status !== "not_saved"}
              canRequestCancellation={canRequestCancellation(booking, now)}
              cancellationRequestedAt={booking.cancellationRequest?.requestedAt ?? null}
            />

            <p className="text-sm text-muted">
              Spørsmål? Ring{" "}
              <a href={`tel:${OWNER_PHONE_TEL}`} className="text-accent underline">
                {OWNER_PHONE_DISPLAY}
              </a>{" "}
              eller send e-post til{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function statusStyle(booking: Booking): string {
  if (booking.status === "declined") return "bg-red-100 text-red-800";
  if (booking.status === "pending" || booking.mainCharge.status === "not_saved") return "bg-yellow-100 text-yellow-800";
  return "bg-emerald-100 text-emerald-800";
}

function PaymentStatus({ booking }: { booking: Booking }) {
  const { mainCharge, deposit, pricing } = booking;
  const extras = booking.extraCharges.filter((c) => c.status === "succeeded");

  if (booking.status === "pending") {
    return (
      <p className="text-sm text-muted">
        Ingenting er belastet. Når vi har godkjent forespørselen, får du en e-post med lenke for å sikre et betalingskort.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm text-muted">
      {mainCharge.status === "not_saved" && booking.status === "confirmed" && (
        <p>Sikre et betalingskort for å fullføre bookingen. Ingenting trekkes nå.</p>
      )}
      {mainCharge.status === "card_saved" && (
        <p>
          Kortet er sikret. {formatEur(pricing.total)} trekkes automatisk{" "}
          {mainCharge.chargeAt ? formatDateLong(mainCharge.chargeAt) : "før innsjekk"}.
        </p>
      )}
      {mainCharge.status === "failed" && (
        <p className="text-red-700">Betalingen gikk ikke gjennom. Oppdater kortet nedenfor, så prøver vi igjen.</p>
      )}
      {mainCharge.status === "paid" && (
        <p className="text-emerald-700">
          Betalt {formatEur(pricing.total)}
          {mainCharge.paidAt && ` ${formatDateLong(mainCharge.paidAt.slice(0, 10))}`}.
        </p>
      )}

      {booking.status === "confirmed" && (
        <p>
          Depositum {formatEur(deposit.amount)}:{" "}
          {deposit.status === "held"
            ? `reservert på kortet, frigis normalt innen ${DEPOSIT_HOLD_DAYS} dager etter utsjekk.`
            : deposit.status === "captured"
              ? `${formatEur(deposit.capturedAmount ?? deposit.amount)} trukket${deposit.captureReason ? ` – ${deposit.captureReason}` : ""}.`
              : deposit.status === "released"
                ? "frigitt."
                : `reserveres (ikke trukket) dagen før utsjekk, og frigis normalt innen ${DEPOSIT_HOLD_DAYS} dager etter utsjekk.`}
        </p>
      )}

      {extras.length > 0 && (
        <ul className="space-y-1">
          {extras.map((c) => (
            <li key={c.id}>
              Tilleggsbeløp {formatEur(c.amount)} – {c.description}
            </li>
          ))}
        </ul>
      )}

      {booking.refunds.length > 0 ? (
        <ul className="space-y-1 text-emerald-700">
          {booking.refunds.map((r) => (
            <li key={r.id}>
              Refundert {formatEur(r.amount)} {formatDateLong(r.createdAt.slice(0, 10))}
            </li>
          ))}
        </ul>
      ) : (
        mainCharge.refundedAmount !== null &&
        mainCharge.refundedAmount > 0 && <p className="text-emerald-700">Refundert {formatEur(mainCharge.refundedAmount)}.</p>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
      <p className="mb-3 font-display text-lg text-brand">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-foreground first-letter:uppercase">{value}</dd>
    </div>
  );
}

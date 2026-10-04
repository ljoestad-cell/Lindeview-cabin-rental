"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { policyRefundAmount } from "@/lib/cancellation";
import { today } from "@/lib/dates";
import { formatEur, type BookingExtras } from "@/lib/pricing";
import type { Booking, BookingStatus } from "@/lib/types";
import PaymentPanel from "@/components/admin/PaymentPanel";

function extrasSummary(extras: BookingExtras): string {
  const parts: string[] = [];
  if (extras.evChargers > 0) parts.push(`${extras.evChargers} el-bil${extras.evChargers > 1 ? "er" : ""}`);
  if (extras.pets > 0) parts.push(`${extras.pets} kjæledyr`);
  if (extras.bedding > 0) parts.push(`${extras.bedding} sett sengetøy/håndklær`);
  return parts.join(", ");
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Venter",
  confirmed: "Bekreftet",
  declined: "Avslått",
};

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: "bg-accent/15 text-accent-dark",
  confirmed: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-700",
};

/** Avbestilling som venter på bekreftelse i panelet. refund er bare satt for betalte bookinger. */
type PendingCancel = { id: string; refund?: "policy" | "full" };

export default function BookingsTable({
  initialBookings,
  guestEmailEnabled,
}: {
  initialBookings: Booking[];
  /** Om e-post til gjester er satt opp (RESEND_FROM_EMAIL) – ellers kan avbestillings-e-posten ikke sendes. */
  guestEmailEnabled: boolean;
}) {
  const router = useRouter();
  const [bookings, setBookings] = useState(initialBookings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<PendingCancel | null>(null);

  /** Henter (og ved behov oppretter) gjestens «Min booking»-lenke og kopierer den. */
  async function copyGuestLink(b: Booking) {
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${b.id}/guest-link`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kunne ikke hente gjestelenken.");
        return;
      }
      await navigator.clipboard.writeText(data.url);
      setCopiedId(b.id);
      setTimeout(() => setCopiedId((current) => (current === b.id ? null : current)), 2000);
    } catch {
      setError("Kunne ikke kopiere gjestelenken.");
    }
  }

  async function updateStatus(
    id: string,
    status: "confirmed" | "declined",
    { refund, notifyGuest = false }: { refund?: "policy" | "full"; notifyGuest?: boolean } = {},
  ) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, refund, notifyGuest }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kunne ikke oppdatere bookingen.");
        return;
      }
      setBookings((prev) => prev.map((b) => (b.id === id ? data.booking : b)));
      setPendingCancel(null);
      router.refresh();
    } catch {
      setError("Kunne ikke kontakte serveren.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Slette denne bookingen permanent?")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Kunne ikke slette bookingen.");
        return;
      }
      setBookings((prev) => prev.filter((b) => b.id !== id));
      router.refresh();
    } catch {
      setError("Kunne ikke kontakte serveren.");
    } finally {
      setBusyId(null);
    }
  }

  if (bookings.length === 0) {
    return <p className="text-muted">Ingen bookingforespørsler ennå.</p>;
  }

  return (
    <div>
      <p className="text-sm text-muted">Klikk Bekreft eller Avslå for å behandle en forespørsel.</p>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 space-y-4">
        {bookings.map((b) => (
          <div key={b.id} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[b.status]}`}>
                  {STATUS_LABEL[b.status]}
                </span>
                <p className="mt-2 font-display text-lg text-brand">
                  {b.checkIn} → {b.checkOut} · {b.nights} netter
                </p>
                <p className="text-sm text-muted">
                  {b.name} · {b.email} · {b.phone} · {b.guests} gjester
                </p>
                {b.message && <p className="mt-2 text-sm text-foreground">«{b.message}»</p>}
                {extrasSummary(b.extras) && (
                  <p className="mt-2 text-sm text-muted">Tillegg: {extrasSummary(b.extras)}</p>
                )}
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatEur(b.pricing.total)} totalt
                </p>
                {b.mainCharge.refundedAmount !== null && (
                  <p className="text-sm text-muted">Refundert {formatEur(b.mainCharge.refundedAmount)}</p>
                )}
                {b.guestEmails.cancellationSentAt && (
                  <p className="text-sm text-muted">
                    Avbestillings-e-post sendt til gjesten {b.guestEmails.cancellationSentAt.slice(0, 10)}
                  </p>
                )}
                {b.cancellationRequest && b.status !== "declined" && (
                  <p className="mt-2 rounded-lg bg-yellow-100 px-3 py-2 text-sm text-yellow-800">
                    Gjesten ba om avbestilling {b.cancellationRequest.requestedAt.slice(0, 10)}
                    {b.cancellationRequest.message && <>: «{b.cancellationRequest.message}»</>}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {b.status === "pending" && (
                  <>
                    <ActionButton
                      onClick={() => updateStatus(b.id, "confirmed")}
                      disabled={busyId === b.id}
                      variant="primary"
                    >
                      Bekreft
                    </ActionButton>
                    <ActionButton
                      onClick={() => updateStatus(b.id, "declined")}
                      disabled={busyId === b.id}
                    >
                      Avslå
                    </ActionButton>
                  </>
                )}
                {b.status === "confirmed" && b.mainCharge.status !== "paid" && (
                  <ActionButton onClick={() => setPendingCancel({ id: b.id })} disabled={busyId === b.id}>
                    Avbestill
                  </ActionButton>
                )}
                {b.status === "confirmed" && b.mainCharge.status === "paid" && (
                  <CancelPaidButtons
                    booking={b}
                    busy={busyId === b.id}
                    onCancel={(refund) => setPendingCancel({ id: b.id, refund })}
                  />
                )}
                {!b.anonymizedAt && (
                  <ActionButton onClick={() => copyGuestLink(b)} disabled={busyId === b.id}>
                    {copiedId === b.id ? "Kopiert!" : "Kopier gjestelenke"}
                  </ActionButton>
                )}
                <ActionButton onClick={() => remove(b.id)} disabled={busyId === b.id} variant="danger">
                  Slett
                </ActionButton>
              </div>
            </div>

            {pendingCancel?.id === b.id && b.status === "confirmed" && (
              <CancelConfirm
                booking={b}
                refund={pendingCancel.refund}
                guestEmailEnabled={guestEmailEnabled}
                busy={busyId === b.id}
                onConfirm={(notifyGuest) =>
                  updateStatus(b.id, "declined", { refund: pendingCancel.refund, notifyGuest })
                }
                onCancel={() => setPendingCancel(null)}
              />
            )}

            {b.status === "confirmed" && (
              <PaymentPanel
                booking={b}
                onUpdate={(updated) => setBookings((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Avbestilling av en betalt booking: gjesten avbestiller (refusjon etter
 * leievilkårene, se lib/cancellation.ts) eller eieren avlyser (full refusjon).
 */
function CancelPaidButtons({
  booking,
  busy,
  onCancel,
}: {
  booking: Booking;
  busy: boolean;
  onCancel: (refund: "policy" | "full") => void;
}) {
  const policyAmount = policyRefundAmount(booking.pricing.total, booking.checkIn, today());
  return (
    <>
      <ActionButton onClick={() => onCancel("policy")} disabled={busy}>
        Gjesten avbestiller ({formatEur(policyAmount)} tilbake)
      </ActionButton>
      <ActionButton onClick={() => onCancel("full")} disabled={busy}>
        Vi avlyser (full refusjon)
      </ActionButton>
    </>
  );
}

/**
 * Bekreftelse før en bekreftet booking avbestilles – erstatter confirm() så
 * eieren kan velge om gjesten skal få avbestillings-e-post (standard: ja).
 */
function CancelConfirm({
  booking,
  refund,
  guestEmailEnabled,
  busy,
  onConfirm,
  onCancel,
}: {
  booking: Booking;
  refund?: "policy" | "full";
  guestEmailEnabled: boolean;
  busy: boolean;
  onConfirm: (notifyGuest: boolean) => void;
  onCancel: () => void;
}) {
  const canEmail = guestEmailEnabled && Boolean(booking.email);
  const [notifyGuest, setNotifyGuest] = useState(canEmail);
  const summary =
    refund === "policy"
      ? `Gjesten avbestiller. ${formatEur(policyRefundAmount(booking.pricing.total, booking.checkIn, today()))} refunderes etter leievilkårene.`
      : refund === "full"
        ? `Vi avlyser. Hele beløpet (${formatEur(booking.pricing.total)}) refunderes.`
        : "Avbestille bookingen? Ingenting er trukket ennå.";

  return (
    <div className="mt-4 space-y-3 rounded-xl bg-red-50/60 p-4 text-sm ring-1 ring-red-200">
      <p className="font-medium text-foreground">{summary}</p>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={notifyGuest}
          disabled={!canEmail}
          onChange={(e) => setNotifyGuest(e.target.checked)}
          className="mt-0.5"
        />
        <span className={canEmail ? "text-foreground" : "text-muted"}>
          Send e-post til gjesten om avbestillingen
          {!canEmail && (
            <span className="block text-xs">
              {booking.email ? "E-post til gjester er ikke satt opp (RESEND_FROM_EMAIL)." : "Bookingen har ingen e-postadresse."}
            </span>
          )}
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={() => onConfirm(notifyGuest)} disabled={busy} variant="danger">
          {busy ? "Avbestiller …" : "Bekreft avbestilling"}
        </ActionButton>
        <ActionButton onClick={onCancel} disabled={busy}>
          Avbryt
        </ActionButton>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  variant?: "default" | "primary" | "danger";
}) {
  const styles = {
    default: "border border-line text-brand hover:bg-brand/5",
    primary: "bg-accent text-white hover:bg-accent-dark",
    danger: "border border-red-200 text-red-700 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

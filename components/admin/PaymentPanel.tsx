"use client";

import { useState } from "react";
import { DEPOSIT_CAPTURE_REASON_MAX, DEPOSIT_HOLD_DAYS, REFUND_REASON_MAX } from "@/lib/config";
import { addDays, today } from "@/lib/dates";
import { formatEur, prepaymentAmount } from "@/lib/pricing";
import { chargedAmount, refundableAmount, refundsFor } from "@/lib/refunds";
import type { Booking, RefundTarget } from "@/lib/types";

type Props = { booking: Booking; onUpdate: (booking: Booking) => void };

async function callApi(url: string, body?: object): Promise<Booking> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Noe gikk galt.");
  return data.booking as Booking;
}

export default function PaymentPanel({ booking, onUpdate }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [captureAmount, setCaptureAmount] = useState(String(booking.deposit.amount));
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureReason, setCaptureReason] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [extraDesc, setExtraDesc] = useState("");

  const base = `/api/bookings/${booking.id}`;

  async function run(action: string, url: string, body?: object): Promise<boolean> {
    setBusy(action);
    setError(null);
    try {
      const updated = await callApi(url, body);
      onUpdate(updated);
      if (action === "extra") {
        setExtraAmount("");
        setExtraDesc("");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function refundControl(target: RefundTarget, extraChargeId: string | null = null) {
    const action = `refund-${target}-${extraChargeId ?? ""}`;
    return (
      <RefundControl
        booking={booking}
        target={target}
        extraChargeId={extraChargeId}
        busy={busy === action}
        onRefund={(amount, reason) => run(action, `${base}/refund`, { target, extraChargeId, amount, reason })}
      />
    );
  }

  function copyLink() {
    if (!booking.secureCardUrl) return;
    navigator.clipboard.writeText(booking.secureCardUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl bg-background p-4 text-sm ring-1 ring-line">
      <p className="font-semibold text-foreground">Betaling</p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}

      {/* Forskudd */}
      {booking.prepayment.status === "paid" && (
        <div className="space-y-1.5">
          <p className="text-emerald-700">
            {booking.prepayment.amount >= booking.pricing.total ? "Hele leien betalt" : "Forskudd betalt"}{" "}
            {formatEur(booking.prepayment.amount)} ✓{" "}
            {booking.prepayment.paidAt && `(${booking.prepayment.paidAt.slice(0, 10)})`}
          </p>
          {refundControl("prepayment")}
        </div>
      )}

      {/* Resten (hovedbeløp) */}
      <div className="space-y-1.5">
        {booking.mainCharge.status === "not_saved" && (
          <>
            <StatusBadge variant="yellow">
              Venter på at gjesten betaler forskudd (
              {formatEur(prepaymentAmount(booking.pricing.total, booking.checkIn, today()))})
            </StatusBadge>
            {booking.secureCardUrl && (
              <div className="flex items-center gap-2">
                <a
                  href={booking.secureCardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-accent underline"
                >
                  {booking.secureCardUrl}
                </a>
                <button type="button" onClick={copyLink} className="shrink-0 text-xs font-medium text-brand underline">
                  {copied ? "Kopiert!" : "Kopier"}
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <SmallButton busy={busy === "link"} onClick={() => run("link", `${base}/payment-link`)}>
                {booking.secureCardUrl ? "Generer ny lenke" : "Lag betalingslenke"}
              </SmallButton>
              {booking.secureCardUrl && (
                <SmallButton busy={busy === "email"} onClick={() => run("email", `${base}/guest-email`)}>
                  Send e-post til gjest
                </SmallButton>
              )}
            </div>
            {booking.guestEmails.approvalSentAt && (
              <p className="text-xs text-muted">
                Betalingslenke sendt på e-post {booking.guestEmails.approvalSentAt.slice(0, 10)}
              </p>
            )}
          </>
        )}
        {booking.mainCharge.status === "card_saved" && (
          <>
            <StatusBadge variant="green">Kort sikret</StatusBadge>
            {booking.guestEmails.confirmationSentAt && (
              <p className="text-xs text-muted">
                Bekreftelse sendt til gjesten {booking.guestEmails.confirmationSentAt.slice(0, 10)}
              </p>
            )}
            <p className="text-muted">
              {booking.prepayment.status === "paid" ? "Resten" : "Leien"} (
              {formatEur(booking.mainCharge.amount ?? booking.pricing.total)}) belastes automatisk{" "}
              {booking.mainCharge.chargeAt}, eller belast nå:
            </p>
            <SmallButton busy={busy === "charge"} onClick={() => run("charge", `${base}/charge`)}>
              Belast nå
            </SmallButton>
          </>
        )}
        {booking.mainCharge.status === "paid" && chargedAmount(booking, "main") > 0 && (
          <>
            <p className="text-emerald-700">
              {booking.prepayment.status === "paid" ? "Resten betalt" : "Betalt"}{" "}
              {formatEur(chargedAmount(booking, "main"))} ✓{" "}
              {booking.mainCharge.paidAt && `(${booking.mainCharge.paidAt.slice(0, 10)})`}
            </p>
            {refundControl("main")}
          </>
        )}
        {booking.mainCharge.status === "paid" && booking.guestEmails.confirmationSentAt && (
          <p className="text-xs text-muted">
            Bekreftelse sendt til gjesten {booking.guestEmails.confirmationSentAt.slice(0, 10)}
          </p>
        )}
        {booking.mainCharge.status === "failed" && (
          <>
            <p className="text-red-700">
              Trekk av {formatEur(booking.mainCharge.amount ?? booking.pricing.total)} feilet: {booking.mainCharge.lastError}
            </p>
            {booking.guestEmails.paymentFailedSentAt && (
              <p className="text-xs text-muted">
                Gjesten ble bedt om å betale selv {booking.guestEmails.paymentFailedSentAt.slice(0, 10)}
              </p>
            )}
            <SmallButton busy={busy === "charge"} onClick={() => run("charge", `${base}/charge`)}>
              Prøv igjen
            </SmallButton>
          </>
        )}
      </div>

      {/* Depositum */}
      <div className="space-y-1.5 border-t border-line pt-3">
        <p className="font-medium text-foreground">Depositum ({formatEur(booking.deposit.amount)})</p>
        {booking.deposit.status === "none" && (
          <>
            <p className="text-muted">Reserveres automatisk dagen før utsjekk.</p>
            <div className="flex flex-wrap items-center gap-2">
              <SmallButton
                disabled={!booking.defaultPaymentMethodId}
                busy={busy === "deposit-hold"}
                onClick={() => run("deposit-hold", `${base}/deposit`, { action: "hold" })}
              >
                Reserver nå
              </SmallButton>
              <SmallButton
                busy={busy === "deposit-release"}
                onClick={() => run("deposit-release", `${base}/deposit`, { action: "release" })}
              >
                Frigi depositum
              </SmallButton>
            </div>
          </>
        )}
        {booking.deposit.status === "held" && (
          <>
            <p className="text-muted">
              Reservert {booking.deposit.heldAt?.slice(0, 10)}. Frigis normalt innen{" "}
              {addDays(booking.checkOut, DEPOSIT_HOLD_DAYS)} ({DEPOSIT_HOLD_DAYS} dager etter utsjekk),
              før korthold utløper automatisk.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={captureAmount}
                onChange={(e) => setCaptureAmount(e.target.value)}
                type="number"
                min={1}
                max={booking.deposit.amount}
                className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
              />
              <SmallButton busy={false} disabled={captureOpen} onClick={() => setCaptureOpen(true)}>
                Trekk
              </SmallButton>
              <SmallButton
                busy={busy === "deposit-release"}
                onClick={() => run("deposit-release", `${base}/deposit`, { action: "release" })}
              >
                Frigi depositum
              </SmallButton>
            </div>
            {captureOpen && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-medium text-foreground" htmlFor={`capture-reason-${booking.id}`}>
                  Hvorfor trekkes {captureAmount ? formatEur(Number(captureAmount)) : "beløpet"}?
                </label>
                <textarea
                  id={`capture-reason-${booking.id}`}
                  value={captureReason}
                  onChange={(e) => setCaptureReason(e.target.value)}
                  maxLength={DEPOSIT_CAPTURE_REASON_MAX}
                  rows={3}
                  placeholder="F.eks. knust glassbord i stua"
                  className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <SmallButton
                    disabled={!captureReason.trim() || !captureAmount}
                    busy={busy === "deposit-capture"}
                    onClick={() =>
                      run("deposit-capture", `${base}/deposit`, {
                        action: "capture",
                        amount: Number(captureAmount),
                        reason: captureReason,
                      })
                    }
                  >
                    Bekreft trekk
                  </SmallButton>
                  <SmallButton busy={false} onClick={() => setCaptureOpen(false)}>
                    Avbryt
                  </SmallButton>
                  <span className="ml-auto text-xs text-muted">
                    {captureReason.length}/{DEPOSIT_CAPTURE_REASON_MAX}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        {booking.deposit.status === "captured" && (
          <>
            <p className="text-emerald-700">
              Trukket {formatEur(booking.deposit.capturedAmount ?? booking.deposit.amount)}
              {booking.deposit.resolvedAt && ` (${booking.deposit.resolvedAt.slice(0, 10)})`}
              {booking.deposit.captureReason && <span className="text-muted"> – {booking.deposit.captureReason}</span>}
            </p>
            {refundControl("deposit")}
          </>
        )}
        {booking.deposit.status === "released" && (
          <p className="text-muted">
            Frigitt{booking.deposit.resolvedAt && ` ${booking.deposit.resolvedAt.slice(0, 10)}`}.
          </p>
        )}
        {booking.deposit.status === "failed" && (
          <>
            <p className="text-red-700">Depositum feilet: {booking.deposit.lastError}</p>
            <SmallButton
              busy={busy === "deposit-hold"}
              onClick={() => run("deposit-hold", `${base}/deposit`, { action: "hold" })}
            >
              Prøv igjen
            </SmallButton>
          </>
        )}
      </div>

      {/* Tilleggsbeløp */}
      <div className="space-y-1.5 border-t border-line pt-3">
        <p className="font-medium text-foreground">Tilleggsbeløp</p>
        {booking.extraCharges.length > 0 && (
          <ul className="space-y-1 text-muted">
            {booking.extraCharges.map((c) => (
              <li key={c.id} className="space-y-1">
                <p>
                  {formatEur(c.amount)} – {c.description}
                  {c.status === "failed" && <span className="text-red-700"> (feilet)</span>}
                </p>
                {c.status === "succeeded" && refundControl("extra", c.id)}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Beløp"
            value={extraAmount}
            onChange={(e) => setExtraAmount(e.target.value)}
            type="number"
            min={1}
            className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
          />
          <input
            placeholder="Beskrivelse"
            value={extraDesc}
            onChange={(e) => setExtraDesc(e.target.value)}
            className="min-w-[10rem] flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
          />
          <SmallButton
            disabled={!booking.defaultPaymentMethodId || !extraAmount || !extraDesc.trim()}
            busy={busy === "extra"}
            onClick={() =>
              run("extra", `${base}/extra-charge`, { amount: Number(extraAmount), description: extraDesc })
            }
          >
            Trekk
          </SmallButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Viser tidligere refusjoner av én belastning, og en «Refunder»-knapp som
 * åpner et skjema (beløp + begrunnelse) så lenge noe gjenstår å tilbakeføre.
 */
function RefundControl({
  booking,
  target,
  extraChargeId,
  busy,
  onRefund,
}: {
  booking: Booking;
  target: RefundTarget;
  extraChargeId: string | null;
  busy: boolean;
  onRefund: (amount: number, reason: string) => Promise<boolean>;
}) {
  const refundable = refundableAmount(booking, target, extraChargeId);
  const done = refundsFor(booking, target, extraChargeId);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(refundable));
  const [reason, setReason] = useState("");
  const inputId = `refund-reason-${booking.id}-${target}-${extraChargeId ?? ""}`;

  function openForm() {
    setAmount(String(refundable));
    setReason("");
    setOpen(true);
  }

  async function submit() {
    const value = Number(amount);
    if (!confirm(`Refunder ${formatEur(value)} til gjesten? Dette kan ikke angres.`)) return;
    if (await onRefund(value, reason)) setOpen(false);
  }

  const amountValid = Number(amount) > 0 && Number(amount) <= refundable;

  return (
    <div className="space-y-1">
      {done.map((r) => (
        <p key={r.id} className="text-xs text-muted">
          Refundert {formatEur(r.amount)} {r.createdAt.slice(0, 10)} – {r.reason}
        </p>
      ))}
      {refundable > 0 && !open && (
        <SmallButton busy={false} onClick={openForm}>
          Refunder
        </SmallButton>
      )}
      {refundable > 0 && open && (
        <div className="space-y-1.5 rounded-lg bg-surface p-2 ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min={0.01}
              step={0.01}
              max={refundable}
              aria-label="Beløp som refunderes"
              className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-muted">av maks {formatEur(refundable)}</span>
          </div>
          <label className="block text-xs font-medium text-foreground" htmlFor={inputId}>
            Hvorfor refunderes beløpet?
          </label>
          <textarea
            id={inputId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={REFUND_REASON_MAX}
            rows={2}
            placeholder="F.eks. trukket feil beløp"
            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <SmallButton disabled={!reason.trim() || !amountValid} busy={busy} onClick={submit}>
              Bekreft refusjon
            </SmallButton>
            <SmallButton busy={false} onClick={() => setOpen(false)}>
              Avbryt
            </SmallButton>
            <span className="ml-auto text-xs text-muted">
              {reason.length}/{REFUND_REASON_MAX}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Samme "ramme"-stil som status-pillen på selve bookingen (se BookingsTable). */
function StatusBadge({ children, variant }: { children: React.ReactNode; variant: "yellow" | "green" }) {
  const styles = {
    yellow: "bg-yellow-100 text-yellow-800",
    green: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${styles[variant]}`}>
      {children}
    </span>
  );
}

function SmallButton({
  children,
  onClick,
  busy,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "..." : children}
    </button>
  );
}

"use client";

import { useState } from "react";
import { DEPOSIT_AMOUNT, DEPOSIT_HOLD_DAYS } from "@/lib/config";
import { formatEur } from "@/lib/pricing";
import type { Booking } from "@/lib/types";

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
  const [captureAmount, setCaptureAmount] = useState(String(DEPOSIT_AMOUNT));
  const [extraAmount, setExtraAmount] = useState("");
  const [extraDesc, setExtraDesc] = useState("");

  const base = `/api/bookings/${booking.id}`;

  async function run(action: string, url: string, body?: object) {
    setBusy(action);
    setError(null);
    try {
      const updated = await callApi(url, body);
      onUpdate(updated);
      if (action === "extra") {
        setExtraAmount("");
        setExtraDesc("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt.");
    } finally {
      setBusy(null);
    }
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

      {/* Hovedbeløp */}
      <div className="space-y-1.5">
        {booking.mainCharge.status === "not_saved" && (
          <>
            <p className="text-muted">Venter på at gjesten sikrer en betalingsmetode.</p>
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
            <SmallButton busy={busy === "link"} onClick={() => run("link", `${base}/payment-link`)}>
              {booking.secureCardUrl ? "Generer ny lenke" : "Lag betalingslenke"}
            </SmallButton>
          </>
        )}
        {booking.mainCharge.status === "card_saved" && (
          <>
            <p className="text-muted">
              Kort sikret. Belastes automatisk {booking.mainCharge.chargeAt}, eller belast nå:
            </p>
            <SmallButton busy={busy === "charge"} onClick={() => run("charge", `${base}/charge`)}>
              Belast nå
            </SmallButton>
          </>
        )}
        {booking.mainCharge.status === "paid" && (
          <p className="text-emerald-700">
            Betalt {formatEur(booking.pricing.total)} ✓{" "}
            {booking.mainCharge.paidAt && `(${booking.mainCharge.paidAt.slice(0, 10)})`}
          </p>
        )}
        {booking.mainCharge.status === "failed" && (
          <>
            <p className="text-red-700">Betaling feilet: {booking.mainCharge.lastError}</p>
            <SmallButton busy={busy === "charge"} onClick={() => run("charge", `${base}/charge`)}>
              Prøv igjen
            </SmallButton>
          </>
        )}
      </div>

      {/* Depositum */}
      <div className="space-y-1.5 border-t border-line pt-3">
        <p className="font-medium text-foreground">Depositum ({formatEur(DEPOSIT_AMOUNT)})</p>
        {booking.deposit.status === "none" && (
          <>
            <p className="text-muted">Reserveres automatisk på utsjekksdagen.</p>
            <SmallButton
              disabled={!booking.defaultPaymentMethodId}
              busy={busy === "deposit-hold"}
              onClick={() => run("deposit-hold", `${base}/deposit`, { action: "hold" })}
            >
              Reserver nå
            </SmallButton>
          </>
        )}
        {booking.deposit.status === "held" && (
          <>
            <p className="text-muted">
              Reservert {booking.deposit.heldAt?.slice(0, 10)}. Trekk eller frigi innen
              ca. {DEPOSIT_HOLD_DAYS} dager, før korthold utløper automatisk.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={captureAmount}
                onChange={(e) => setCaptureAmount(e.target.value)}
                type="number"
                min={1}
                max={DEPOSIT_AMOUNT}
                className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
              />
              <SmallButton
                busy={busy === "deposit-capture"}
                onClick={() =>
                  run("deposit-capture", `${base}/deposit`, { action: "capture", amount: Number(captureAmount) })
                }
              >
                Trekk
              </SmallButton>
              <SmallButton
                busy={busy === "deposit-release"}
                onClick={() => run("deposit-release", `${base}/deposit`, { action: "release" })}
              >
                Frigi
              </SmallButton>
            </div>
          </>
        )}
        {booking.deposit.status === "captured" && (
          <p className="text-emerald-700">
            Trukket {formatEur(booking.deposit.capturedAmount ?? DEPOSIT_AMOUNT)}
            {booking.deposit.resolvedAt && ` (${booking.deposit.resolvedAt.slice(0, 10)})`}.
          </p>
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
              <li key={c.id}>
                {formatEur(c.amount)} – {c.description}
                {c.status === "failed" && <span className="text-red-700"> (feilet)</span>}
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

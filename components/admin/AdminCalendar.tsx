"use client";

import { useState } from "react";
import { MONTH_LABELS, WEEKDAY_LABELS, buildMonthGrid, monthsInSeason } from "@/lib/calendar-grid";
import { SEASON_END, SEASON_START } from "@/lib/config";
import { rangesOverlap, today, type DateRange } from "@/lib/dates";
import type { BlockedRange, Booking } from "@/lib/types";

type Props = {
  bookings: Booking[];
  initialBlockedRanges: BlockedRange[];
};

type Selection = { start: string | null; end: string | null };

const SEASON = { start: SEASON_START, end: SEASON_END };

function isWithin(iso: string, ranges: DateRange[]): boolean {
  return ranges.some((r) => iso >= r.start && iso < r.end);
}

export default function AdminCalendar({ bookings, initialBlockedRanges }: Props) {
  const [blockedRanges, setBlockedRanges] = useState(initialBlockedRanges);
  const [selection, setSelection] = useState<Selection>({ start: null, end: null });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const pending = bookings.filter((b) => b.status === "pending");
  const manualBlocks = blockedRanges.filter((r) => (r.source ?? "manual") === "manual");
  const airbnbBlocks = blockedRanges.filter((r) => r.source === "airbnb");

  function bookingAt(iso: string, list: Booking[]): Booking | undefined {
    return list.find((b) => iso >= b.checkIn && iso < b.checkOut);
  }

  function dayState(
    iso: string,
  ): "confirmed" | "pending" | "blocked" | "airbnb" | "selecting" | "available" | "disabled" {
    if (selection.start && selection.end && iso >= selection.start && iso < selection.end) return "selecting";
    if (iso === selection.start) return "selecting";
    if (iso < today() || iso >= SEASON.end) return "disabled";
    if (bookingAt(iso, confirmed)) return "confirmed";
    if (bookingAt(iso, pending)) return "pending";
    if (isWithin(iso, airbnbBlocks)) return "airbnb";
    if (isWithin(iso, manualBlocks)) return "blocked";
    return "available";
  }

  function handleClick(iso: string) {
    const state = dayState(iso);
    if (state !== "available" && state !== "selecting") return;

    setError(null);
    const { start, end } = selection;
    if (!start || end) {
      setSelection({ start: iso, end: null });
      return;
    }
    if (iso <= start) {
      setSelection({ start: iso, end: null });
      return;
    }
    // Ikke tillat at en ny blokkering spenner over noe som allerede er utilgjengelig.
    const spansUnavailable = [...confirmed, ...pending].some((b) =>
      rangesOverlap({ start, end: iso }, { start: b.checkIn, end: b.checkOut }),
    );
    if (spansUnavailable || isWithin(iso, blockedRanges)) {
      setSelection({ start: iso, end: null });
      return;
    }
    setSelection({ start, end: iso });
  }

  async function createBlock() {
    if (!selection.start || !selection.end) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/blocked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: selection.start, end: selection.end, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kunne ikke blokkere perioden.");
        return;
      }
      setBlockedRanges((prev) => [...prev, data.range]);
      setSelection({ start: null, end: null });
      setReason("");
    } catch {
      setError("Kunne ikke kontakte serveren.");
    } finally {
      setBusy(false);
    }
  }

  async function removeBlock(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/blocked/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Kunne ikke fjerne blokkeringen.");
        return;
      }
      setBlockedRanges((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Kunne ikke kontakte serveren.");
    } finally {
      setBusy(false);
    }
  }

  const styles: Record<string, string> = {
    disabled: "cursor-not-allowed text-muted/30",
    confirmed: "bg-emerald-600 text-white",
    pending: "bg-accent/60 text-white",
    blocked: "bg-muted/40 text-white line-through",
    airbnb: "bg-rose-500/70 text-white line-through",
    selecting: "bg-brand text-white font-semibold",
    available: "text-foreground hover:bg-brand/10 cursor-pointer",
  };

  return (
    <div>
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {selection.start && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-surface p-4 ring-1 ring-line">
          <p className="text-sm text-foreground">
            {selection.start} {selection.end ? `→ ${selection.end}` : "→ velg sluttdato"}
          </p>
          {selection.end && (
            <>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Årsak (valgfritt)"
                className="min-w-[10rem] flex-1 rounded-lg border border-line bg-background px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={createBlock}
                disabled={busy}
                className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
              >
                Blokker
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setSelection({ start: null, end: null })}
            className="text-sm font-medium text-muted underline"
          >
            Avbryt
          </button>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {monthsInSeason(SEASON).map(({ year, month }) => (
          <div key={`${year}-${month}`} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <p className="text-center font-display text-lg text-brand">
              {MONTH_LABELS[month]} {year}
            </p>
            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted">
              {WEEKDAY_LABELS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {buildMonthGrid(year, month).flatMap((week, wi) =>
                week.map((iso, di) => {
                  if (!iso) return <span key={`${wi}-${di}`} />;
                  const state = dayState(iso);
                  const day = Number(iso.slice(8, 10));
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={state === "disabled" || state === "confirmed" || state === "pending"}
                      onClick={() => handleClick(iso)}
                      className={`flex h-9 w-full items-center justify-center rounded-full text-sm transition-colors ${styles[state]}`}
                      title={
                        state === "confirmed"
                          ? bookingAt(iso, confirmed)?.name
                          : state === "pending"
                            ? `Forespørsel: ${bookingAt(iso, pending)?.name}`
                            : state === "airbnb"
                              ? "Airbnb-reservasjon"
                              : state === "blocked"
                                ? manualBlocks.find((r) => iso >= r.start && iso < r.end)?.reason || "Blokkert"
                                : undefined
                      }
                    >
                      {day}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-emerald-600" /> Bekreftet booking
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-accent/60" /> Forespørsel
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-muted/40" /> Blokkert
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-500/70" /> Airbnb-reservasjon
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-brand" /> Valgt
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">Klikk to ledige datoer for å velge en periode å blokkere.</p>

      {manualBlocks.length > 0 && (
        <div className="mt-8">
          <p className="font-medium text-foreground">Blokkerte perioder</p>
          <ul className="mt-3 space-y-2">
            {manualBlocks.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm ring-1 ring-line"
              >
                <span>
                  {r.start} → {r.end}
                  {r.reason && <span className="text-muted"> · {r.reason}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => removeBlock(r.id)}
                  disabled={busy}
                  className="text-xs font-semibold text-red-700 underline disabled:opacity-50"
                >
                  Fjern
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {airbnbBlocks.length > 0 && (
        <div className="mt-8">
          <p className="font-medium text-foreground">Airbnb-reservasjoner ({airbnbBlocks.length})</p>
          <p className="mt-1 text-xs text-muted">
            Hentet automatisk fra Airbnb-kalenderen (se «Min konto») – kan ikke fjernes her, de oppdateres ved neste
            synk.
          </p>
          <ul className="mt-3 space-y-2">
            {airbnbBlocks.map((r) => (
              <li key={r.id} className="rounded-xl bg-surface px-4 py-2.5 text-sm ring-1 ring-line">
                {r.start} → {r.end}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

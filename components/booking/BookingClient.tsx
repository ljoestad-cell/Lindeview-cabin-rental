"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_GUESTS, MIN_NIGHTS } from "@/lib/config";
import type { DateRange } from "@/lib/dates";
import { formatEur, quote } from "@/lib/pricing";
import BookingCalendar from "@/components/booking/BookingCalendar";
import PriceSummary from "@/components/booking/PriceSummary";
import PaymentNotice from "@/components/booking/PaymentNotice";

type Availability = {
  season: { start: string; end: string };
  minNights: number;
  blocked: DateRange[];
  tentative: DateRange[];
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  guests: string;
  message: string;
};

const EMPTY_FORM: FormState = { name: "", email: "", phone: "", guests: "2", message: "" };

const INPUT_CLASS =
  "w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent";

export default function BookingClient({ availability }: { availability: Availability }) {
  const router = useRouter();
  const [range, setRange] = useState<{ checkIn: string | null; checkOut: string | null }>({
    checkIn: null,
    checkOut: null,
  });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = Boolean(range.checkIn && range.checkOut) && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!range.checkIn || !range.checkOut) {
      setError("Velg innsjekk og utsjekk i kalenderen først.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkIn: range.checkIn,
          checkOut: range.checkOut,
          guests: Number(form.guests),
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: form.message,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Noe gikk galt. Prøv igjen.");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Kunne ikke sende forespørselen. Sjekk nettforbindelsen og prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success && range.checkIn && range.checkOut) {
    const { total } = quote(range.checkIn, range.checkOut);
    return (
      <div className="rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
        <p className="font-display text-2xl text-brand">Forespørselen er sendt!</p>
        <p className="mt-3 text-muted">
          {range.checkIn} – {range.checkOut} · {formatEur(total)} totalt. Vi tar kontakt på{" "}
          {form.email} så snart forespørselen er behandlet.
        </p>
        <button
          type="button"
          onClick={() => {
            setSuccess(false);
            setRange({ checkIn: null, checkOut: null });
            setForm(EMPTY_FORM);
          }}
          className="mt-6 rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
        >
          Send en ny forespørsel
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <div>
        <BookingCalendar
          season={availability.season}
          minNights={availability.minNights}
          blocked={availability.blocked}
          tentative={availability.tentative}
          value={range}
          onChange={(next) => {
            setRange(next);
            setError(null);
          }}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <PriceSummary checkIn={range.checkIn} checkOut={range.checkOut} />

        <div className="space-y-4 rounded-2xl bg-surface p-6 ring-1 ring-line">
          <Field label="Navn">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="E-post">
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Telefon">
            <input
              required
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Antall gjester">
            <input
              required
              type="number"
              min={1}
              max={MAX_GUESTS}
              value={form.guests}
              onChange={(e) => setForm({ ...form, guests: e.target.value })}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Melding (valgfritt)">
            <textarea
              rows={3}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className={`${INPUT_CLASS} resize-none`}
            />
          </Field>
        </div>

        <PaymentNotice />

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Sender..." : "Send booking-forespørsel"}
        </button>
        <p className="text-center text-xs text-muted">
          Minimum opphold er {MIN_NIGHTS} netter. Dette er en forespørsel, ikke en
          bekreftet booking — du hører fra oss innen kort tid.
        </p>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

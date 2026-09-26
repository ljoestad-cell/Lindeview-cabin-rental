"use client";

import { useState } from "react";
import type { Prices } from "@/lib/pricing";

const INPUT_CLASS =
  "w-full rounded-xl border border-line bg-background py-2.5 pl-4 pr-10 text-sm text-foreground outline-none transition-colors focus:border-accent";

type Field = { key: keyof Prices; label: string; hint: string };

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Leie",
    fields: [
      { key: "nightlyRate", label: "Pris per natt", hint: "Ganges med antall netter." },
      { key: "cleaningFee", label: "Rengjøringsgebyr", hint: "Fast beløp per booking." },
    ],
  },
  {
    title: "Tillegg",
    fields: [
      { key: "evCharger", label: "Lading av el-bil", hint: "Per bil, per booking." },
      { key: "pet", label: "Kjæledyr", hint: "Per dyr, per booking." },
      { key: "bedding", label: "Sengetøy & håndklær", hint: "Per sett, per booking." },
    ],
  },
  {
    title: "Depositum",
    fields: [
      { key: "deposit", label: "Depositum", hint: "Reserveres på kortet ved utsjekk." },
    ],
  },
];

type FormValues = Record<keyof Prices, string>;

function toFormValues(prices: Prices): FormValues {
  return Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, String(v)])) as FormValues;
}

export default function PricesForm({ initialPrices }: { initialPrices: Prices }) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(initialPrices));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const body = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, Number(v.replace(",", "."))]),
      );
      const res = await fetch("/api/admin/prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kunne ikke lagre.");
        return;
      }
      setValues(toFormValues(data.prices));
      setSaved(true);
    } catch {
      setError("Kunne ikke kontakte serveren.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-muted">
        Alle beløp er i euro. Nye priser gjelder for nye bookingforespørsler — bookinger som
        allerede er sendt inn beholder prisen gjesten så.
      </p>

      {GROUPS.map((group) => (
        <section key={group.title} className="rounded-2xl bg-surface p-6 ring-1 ring-line">
          <h2 className="font-display text-lg text-brand">{group.title}</h2>
          <div className="mt-4 space-y-4">
            {group.fields.map((field) => (
              <label key={field.key} className="block">
                <span className="text-sm font-medium text-foreground">{field.label}</span>
                <div className="relative mt-1.5">
                  <input
                    required
                    type="number"
                    inputMode="decimal"
                    min={field.key === "nightlyRate" ? 1 : 0}
                    step="0.01"
                    value={values[field.key]}
                    onChange={(e) => {
                      setValues({ ...values, [field.key]: e.target.value });
                      setSaved(false);
                    }}
                    className={INPUT_CLASS}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">
                    €
                  </span>
                </div>
                <span className="mt-1 block text-xs text-muted">{field.hint}</span>
              </label>
            ))}
          </div>
        </section>
      ))}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-emerald-700">Prisene er lagret.</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
      >
        {busy ? "Lagrer..." : "Lagre priser"}
      </button>
    </form>
  );
}

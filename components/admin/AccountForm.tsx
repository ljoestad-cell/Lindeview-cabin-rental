"use client";

import { useState, useSyncExternalStore } from "react";
import type { PublicAdminAccount } from "@/lib/admin-account";

const INPUT_CLASS =
  "w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent";

export default function AccountForm({ initialAccount }: { initialAccount: PublicAdminAccount }) {
  return (
    <div className="space-y-10">
      <ProfileSection initialAccount={initialAccount} />
      <PasswordSection />
      <CalendarSyncSection
        icalExportToken={initialAccount.icalExportToken}
        initialAirbnbIcalUrl={initialAccount.airbnbIcalUrl}
        airbnbIcalSyncedAt={initialAccount.airbnbIcalSyncedAt}
      />
      <MfaSection enabled={initialAccount.mfaEnabled} />
    </div>
  );
}

function ProfileSection({ initialAccount }: { initialAccount: PublicAdminAccount }) {
  const [name, setName] = useState(initialAccount.name);
  const [email, setEmail] = useState(initialAccount.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kunne ikke lagre.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Kunne ikke kontakte serveren.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
      <h2 className="font-display text-lg text-brand">Profil</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Navn</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={`mt-1.5 ${INPUT_CLASS}`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">E-post</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={`mt-1.5 ${INPUT_CLASS}`}
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {saved && <p className="text-sm text-emerald-700">Lagret.</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
        >
          {busy ? "Lagrer..." : "Lagre"}
        </button>
      </form>
    </section>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword !== confirmPassword) {
      setError("De to nye passordene er ikke like.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kunne ikke bytte passord.");
        return;
      }
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Kunne ikke kontakte serveren.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
      <h2 className="font-display text-lg text-brand">Bytt passord</h2>
      <p className="mt-1 text-sm text-muted">
        Minst 10 tegn, minst 2 tall og minst 1 spesialtegn (f.eks. !?#%).
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Nåværende passord</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className={`mt-1.5 ${INPUT_CLASS}`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">Nytt passord</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={10}
            className={`mt-1.5 ${INPUT_CLASS}`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">Bekreft nytt passord</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={10}
            className={`mt-1.5 ${INPUT_CLASS}`}
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {saved && <p className="text-sm text-emerald-700">Passordet er byttet.</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
        >
          {busy ? "Bytter..." : "Bytt passord"}
        </button>
      </form>
    </section>
  );
}

function noopSubscribe() {
  return () => {};
}

/** Origin finnes kun i nettleseren – null under SSR, hydreres inn rett etter mount uten mismatch-advarsel. */
function getOriginSnapshot(): string | null {
  return window.location.origin;
}

function getOriginServerSnapshot(): string | null {
  return null;
}

function CalendarSyncSection({
  icalExportToken,
  initialAirbnbIcalUrl,
  airbnbIcalSyncedAt,
}: {
  icalExportToken: string;
  initialAirbnbIcalUrl: string | null;
  airbnbIcalSyncedAt: string | null;
}) {
  const origin = useSyncExternalStore(noopSubscribe, getOriginSnapshot, getOriginServerSnapshot);
  const exportUrl = origin ? `${origin}/api/ical/${icalExportToken}` : null;
  const [copied, setCopied] = useState(false);
  const [airbnbUrl, setAirbnbUrl] = useState(initialAirbnbIcalUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function copyExportUrl() {
    if (!exportUrl) return;
    try {
      await navigator.clipboard.writeText(exportUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Utilgjengelig i noen kontekster (f.eks. usikker/eldre nettleser) – lenken vises uansett for manuell kopiering.
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/account/airbnb-ical", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: airbnbUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kunne ikke lagre.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Kunne ikke kontakte serveren.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-6 ring-1 ring-line">
      <h2 className="font-display text-lg text-brand">Kalendersynkronisering (Airbnb)</h2>
      <p className="mt-1 text-sm text-muted">
        Hytta leies også ut via Airbnb – disse to lenkene holder kalenderne synkronisert i begge retninger, slik at
        de samme datoene ikke kan bookes to steder.
      </p>

      <div className="mt-5">
        <p className="text-sm font-medium text-foreground">1. Lindeviews kalender → Airbnb</p>
        <p className="mt-1 text-sm text-muted">
          Lim inn denne lenken i Airbnb under Kalender → Tilgjengelighet → Synkroniser kalendere → «Importer
          kalender».
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={exportUrl ?? "Laster..."}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-[16rem] flex-1 rounded-lg border border-line bg-background px-3 py-1.5 text-sm text-muted"
          />
          <button
            type="button"
            onClick={copyExportUrl}
            disabled={!exportUrl}
            className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/5 disabled:opacity-50"
          >
            {copied ? "Kopiert!" : "Kopier"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6">
        <label className="block">
          <span className="text-sm font-medium text-foreground">2. Airbnb → Lindeviews kalender</span>
          <p className="mt-1 text-sm text-muted">
            Lim inn Airbnbs eksport-URL herfra (samme sted, «Eksporter kalender»). Sjekkes automatisk én gang
            daglig.
          </p>
          <input
            type="url"
            value={airbnbUrl}
            onChange={(e) => setAirbnbUrl(e.target.value)}
            placeholder="https://www.airbnb.no/calendar/ical/....ics"
            className={`mt-2 ${INPUT_CLASS}`}
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {saved && <p className="mt-3 text-sm text-emerald-700">Lagret.</p>}
        <p className="mt-2 text-xs text-muted">
          {airbnbIcalSyncedAt
            ? `Sist synkronisert: ${new Date(airbnbIcalSyncedAt).toLocaleString("no-NO")}`
            : "Ikke synkronisert ennå."}
        </p>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
        >
          {busy ? "Lagrer..." : "Lagre"}
        </button>
      </form>
    </section>
  );
}

function MfaSection({ enabled }: { enabled: boolean }) {
  return (
    <section className="rounded-2xl border border-dashed border-line bg-background p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg text-brand">Topartsverifisering (MFA)</h2>
          <p className="mt-1 text-sm text-muted">
            Ekstra sikkerhetslag ved innlogging (kode fra en autentiserings-app i tillegg til
            passord). Kommer i en senere oppdatering.
          </p>
        </div>
        <span
          aria-disabled="true"
          className="shrink-0 rounded-full bg-muted/20 px-4 py-1.5 text-xs font-semibold text-muted"
        >
          {enabled ? "På" : "Kommer snart"}
        </span>
      </div>
    </section>
  );
}

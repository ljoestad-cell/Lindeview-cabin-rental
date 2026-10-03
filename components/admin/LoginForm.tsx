"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INPUT_CLASS =
  "mt-1.5 w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm outline-none focus:border-accent";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  /** Riktig passord er gitt, og kontoen har topartsverifisering – vis kodefeltet. */
  const [needsCode, setNeedsCode] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function post(url: string, body: object): Promise<Record<string, unknown> | null> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      // Mellomsteget varer i 5 minutter – da må passordet skrives inn på nytt.
      if (data.expired) {
        setNeedsCode(false);
        setCode("");
      }
      setError(data.error ?? "Kunne ikke logge inn.");
      return null;
    }
    return data;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!needsCode) {
        const data = await post("/api/admin/session", { password });
        if (!data) return;
        if (data.mfaRequired) {
          setNeedsCode(true);
          return;
        }
      } else {
        const data = await post("/api/admin/session/mfa", { code });
        if (!data) return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Kunne ikke kontakte serveren. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-4">
      {!needsCode ? (
        <label className="block">
          <span className="text-sm font-medium text-foreground">Passord</span>
          <input
            autoFocus
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              {useRecoveryCode ? "Reservekode" : "Kode fra autentiseringsappen"}
            </span>
            <input
              key={useRecoveryCode ? "recovery" : "totp"}
              autoFocus
              required
              {...(useRecoveryCode
                ? { autoComplete: "off", placeholder: "abcd-efgh" }
                : { inputMode: "numeric" as const, autoComplete: "one-time-code", pattern: "[0-9 ]*", placeholder: "123456" })}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${INPUT_CLASS} tracking-widest`}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setUseRecoveryCode((v) => !v);
              setCode("");
              setError(null);
            }}
            className="text-xs font-medium text-accent underline"
          >
            {useRecoveryCode ? "Bruk kode fra appen i stedet" : "Har ikke telefonen? Bruk en reservekode"}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
      >
        {submitting ? "Logger inn..." : needsCode ? "Bekreft" : "Logg inn"}
      </button>
    </form>
  );
}

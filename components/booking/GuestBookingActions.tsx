"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CANCELLATION_MESSAGE_MAX } from "@/lib/config";
import { formatDateLong } from "@/lib/dates";

type Props = {
  token: string;
  canUpdateCard: boolean;
  /** Om gjesten allerede har sikret et kort – styrer «Sikre kort» vs. «Bytt kort». */
  cardSaved: boolean;
  canRequestCancellation: boolean;
  cancellationRequestedAt: string | null;
};

async function post(url: string, body?: object): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Noe gikk galt. Prøv igjen.");
  return data;
}

/** Knappene på «Min booking»: sikre/bytte kort og be om avbestilling. Serveren sjekker de samme reglene (lib/guest.ts). */
export default function GuestBookingActions({
  token,
  canUpdateCard,
  cardSaved,
  canRequestCancellation,
  cancellationRequestedAt,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"card" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [message, setMessage] = useState("");

  const base = `/api/guest/${encodeURIComponent(token)}`;

  async function openCardPage() {
    setBusy("card");
    setError(null);
    try {
      const { url } = await post(`${base}/card`);
      window.location.href = url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt.");
      setBusy(null);
    }
  }

  async function sendCancelRequest() {
    setBusy("cancel");
    setError(null);
    try {
      await post(`${base}/cancel-request`, { message });
      setCancelOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt.");
    } finally {
      setBusy(null);
    }
  }

  if (!canUpdateCard && !canRequestCancellation && !cancellationRequestedAt) return null;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {canUpdateCard && (
        <button
          type="button"
          onClick={openCardPage}
          disabled={busy !== null}
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-60"
        >
          {busy === "card" ? "Åpner betalingssiden …" : cardSaved ? "Bytt kort" : "Sikre kort"}
        </button>
      )}

      {cancellationRequestedAt && (
        <p className="rounded-2xl bg-surface p-5 text-sm text-muted ring-1 ring-line">
          Du ba om avbestilling {formatDateLong(cancellationRequestedAt.slice(0, 10))}. Vi tar kontakt med deg så snart vi kan –
          bookingen er ikke avbestilt før du har hørt fra oss.
        </p>
      )}

      {canRequestCancellation && !cancelOpen && (
        <div>
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="rounded-full border border-line px-6 py-3 text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
          >
            Be om avbestilling
          </button>
        </div>
      )}

      {canRequestCancellation && cancelOpen && (
        <div className="space-y-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
          <p className="text-sm text-muted">
            Vi får beskjed og avbestiller for deg. Eventuell refusjon følger leievilkårene.
          </p>
          <label htmlFor="cancel-message" className="block text-sm font-medium text-foreground">
            Melding til oss (valgfritt)
          </label>
          <textarea
            id="cancel-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={CANCELLATION_MESSAGE_MAX}
            rows={3}
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={sendCancelRequest}
              disabled={busy !== null}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {busy === "cancel" ? "Sender …" : "Send forespørsel"}
            </button>
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

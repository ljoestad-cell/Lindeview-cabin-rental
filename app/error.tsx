"use client"; // Feilgrenser må være klientkomponenter

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-32">
      <div className="max-w-md text-center">
        <h1 className="font-display text-4xl text-brand">Noe gikk galt</h1>
        <p className="mt-4 text-muted">
          Siden kunne ikke vises akkurat nå. Prøv igjen, eller ta kontakt hvis problemet fortsetter.
        </p>
        {error.digest && <p className="mt-2 text-xs text-muted">Feilkode: {error.digest}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            Prøv igjen
          </button>
          <Link
            href="/"
            className="rounded-full border border-line px-6 py-3 text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
          >
            Til forsiden
          </Link>
        </div>
      </div>
    </main>
  );
}

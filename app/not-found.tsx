import Link from "next/link";
import { PROPERTY_NAME } from "@/lib/property";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-32">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">{PROPERTY_NAME}</p>
        <h1 className="mt-4 font-display text-4xl text-brand">Fant ikke siden</h1>
        <p className="mt-4 text-muted">Siden finnes ikke, eller den er flyttet.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            Til forsiden
          </Link>
          <Link
            href="/book"
            className="rounded-full border border-line px-6 py-3 text-sm font-semibold text-brand transition-colors hover:bg-brand/5"
          >
            Book opphold
          </Link>
        </div>
      </div>
    </main>
  );
}

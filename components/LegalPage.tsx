import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fromIso } from "@/lib/dates";

/** Felles ramme for /vilkar og /personvern – samme oppsett som bookingsiden. */
export default function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  /** "YYYY-MM-DD" */
  updated: string;
  children: React.ReactNode;
}) {
  const updatedLabel = new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeZone: "UTC" }).format(fromIso(updated));
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 py-20 sm:px-10 sm:py-28">
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            ← Tilbake til forsiden
          </Link>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-accent">{eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-brand sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-muted">Sist oppdatert {updatedLabel}</p>
          <div className="mt-10 space-y-8 text-base leading-relaxed text-foreground">{children}</div>
        </article>
      </main>
      <Footer />
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl text-brand">{title}</h2>
      <div className="mt-3 space-y-3 text-muted [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">{children}</div>
    </section>
  );
}

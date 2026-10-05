import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DEPOSIT_HOLD_DAYS } from "@/lib/config";
import { PROPERTY_NAME } from "@/lib/property";

export const metadata: Metadata = {
  title: `Betaling mottatt | ${PROPERTY_NAME}`,
};

/** Hva Stripe sender gjesten tilbake etter – se CheckoutKind i lib/payments.ts. */
const CONTENT = {
  prepayment: {
    heading: "Bookingen er sikret",
    body: "Takk! Betalingen er mottatt og kortet ditt er registrert. Er det mer enn noen uker til innsjekk, trekkes resten av leien automatisk fra samme kort nærmere innsjekk",
  },
  rest: {
    heading: "Betaling mottatt",
    body: "Takk! Resten av leien er betalt, og bookingen er fullt betalt",
  },
  card: {
    heading: "Kortet er byttet",
    body: "Takk! Det nye kortet er registrert og brukes til de neste betalingene. Du blir ikke belastet nå",
  },
} as const;

export default async function SecuredPage(props: PageProps<"/book/sikret">) {
  const { kind } = await props.searchParams;
  const content = CONTENT[kind === "rest" || kind === "card" ? kind : "prepayment"];
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-24 text-center sm:px-10 sm:py-32">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            Booking
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-brand sm:text-5xl">
            {content.heading}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            {content.body}. Et depositum reserveres dagen før utsjekk og frigis normalt innen{" "}
            {DEPOSIT_HOLD_DAYS} dager etter utsjekk hvis alt er i orden. Du får en bekreftelse på e-post, og hører fra
            oss hvis noe skulle kreve oppfølging.
          </p>
          <Link
            href="/"
            className="mt-10 inline-block rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            Tilbake til forsiden
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}

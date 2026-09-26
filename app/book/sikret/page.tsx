import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PROPERTY_NAME } from "@/lib/property";

export const metadata: Metadata = {
  title: `Kortet er sikret | ${PROPERTY_NAME}`,
};

export default function SecuredPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-24 text-center sm:px-10 sm:py-32">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            Booking
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-brand sm:text-5xl">
            Kortet er sikret
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Takk! Betalingsmetoden din er registrert. Du blir ikke belastet nå
            — hovedbeløpet trekkes automatisk nærmere innsjekk, og et
            depositum reserveres ved utsjekk og frigis normalt innen noen
            dager hvis alt er i orden. Du hører fra oss hvis noe skulle kreve
            oppfølging.
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

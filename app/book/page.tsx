import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingClient from "@/components/booking/BookingClient";
import { getAvailability } from "@/lib/bookings";
import { FAMILY_ONLY_NOTICE, SEASON_LABEL } from "@/lib/config";
import { PROPERTY_NAME } from "@/lib/property";

export const metadata: Metadata = {
  title: `Book ${PROPERTY_NAME} | Bookingforespørsel`,
  description: `Velg datoer og send en bookingforespørsel for ${PROPERTY_NAME}.`,
};

// Tilgjengelighet må alltid være ferskt, aldri statisk generert eller cachet.
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const availability = await getAvailability();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
          <Link href="/#bestill" className="text-sm font-medium text-accent hover:underline">
            ← Tilbake til forsiden
          </Link>

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            Book ditt opphold
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-brand sm:text-5xl">
            Velg datoer
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
            Kalenderen er åpen for {SEASON_LABEL}. Minimum opphold er{" "}
            {availability.minNights} netter. Dette er en forespørsel — du får svar fra oss
            før noe er endelig bekreftet.
          </p>

          <div className="mt-6 max-w-2xl rounded-2xl border border-accent/30 bg-accent/5 px-5 py-4">
            <p className="text-sm font-medium text-brand">{FAMILY_ONLY_NOTICE}</p>
          </div>

          <div className="mt-12">
            <BookingClient availability={availability} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

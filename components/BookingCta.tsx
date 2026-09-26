import Image from "next/image";
import Link from "next/link";

export default function BookingCta() {
  return (
    <section id="bestill" className="relative overflow-hidden bg-brand-dark py-24 sm:py-32">
      <Image
        src="/images/galleri/gress.jpeg"
        alt="Gress i solnedgang ved Lindeview"
        fill
        className="object-cover opacity-25"
        sizes="100vw"
      />
      <div className="relative mx-auto max-w-4xl px-6 text-center sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Book ditt opphold
        </p>
        <h2 className="mt-4 font-display text-4xl leading-tight text-white sm:text-5xl">
          Klar for noen rolige dager på fjellet?
        </h2>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/book"
            className="rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            Send booking-forespørsel
          </Link>
          <a
            href="tel:+4790591820"
            className="rounded-full border border-white/30 px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Ring oss
          </a>
        </div>
      </div>
    </section>
  );
}

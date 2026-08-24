import Image from "next/image";
import { BedDouble, Bath, Users, Fish } from "lucide-react";

const stats = [
  { icon: Users, label: "6 gjester" },
  { icon: BedDouble, label: "3 soverom" },
  { icon: Bath, label: "2 bad" },
  { icon: Fish, label: "Fiskekort inkludert" },
];

export default function Hero() {
  return (
    <section className="relative flex min-h-[92vh] w-full items-end overflow-hidden">
      <Image
        src="/images/galleri/cabin-front-close.jpeg"
        alt="Lindeview sett forfra, med staselig gavl og store vindusflater mot himmelen"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/40" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-16 pt-40 sm:px-10 sm:pb-20">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Hillestadheia · Eksklusiv villmarkshytte
        </p>
        <h1 className="mt-4 max-w-2xl font-display text-5xl leading-[1.05] text-white sm:text-6xl lg:text-7xl">
          Lindeview
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/90">
          Innerst i en fredelig dal, langt fra trafikkerte veier, ligger en
          hytte som gir deg stillheten og villmarken tilbake — med høy
          standard og et gourmetkjøkken som matcher utsikten.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="#bestill"
            className="rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            Sjekk tilgjengelighet
          </a>
          <a
            href="#galleri"
            className="rounded-full border border-white/40 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Se hytta
          </a>
        </div>

        <dl className="mt-14 grid max-w-xl grid-cols-2 gap-x-8 gap-y-5 border-t border-white/20 pt-8 sm:grid-cols-4">
          {stats.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-white">
              <Icon className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
              <dd className="text-sm font-medium">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

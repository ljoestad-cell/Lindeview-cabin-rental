import Image from "next/image";

export default function About() {
  return (
    <section id="om" className="mx-auto max-w-7xl px-6 py-24 sm:px-10 sm:py-32">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl lg:order-2">
          <Image
            src="/images/galleri/mountain-lake-view.jpeg"
            alt="Utsikt over fjellvann og daler sett fra høyden ved Lindeview"
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 40vw, 100vw"
          />
        </div>

        <div className="lg:order-1">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            Beliggenhet
          </p>
          <h2 className="mt-4 font-display text-4xl leading-tight text-brand sm:text-5xl">
            Stillheten du har lett etter
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Lindeview ligger innerst i en fredelig dal på Hillestadheia,
            skjermet fra trafikkerte veier og folksomme hyttefelt. Her er det
            naturen som setter tempoet — med utsikt mot åser og vann så langt
            øyet kan se, og en ro som følger deg fra første kveld på
            terrassen.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Fra dørstokken har du turstier rett ut i terrenget, fiskevann
            innen kort avstand og badestrand i nærheten — et utgangspunkt
            like godt for rolige dager som for aktive.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-6 border-t border-line pt-8">
            <div>
              <p className="font-display text-3xl text-brand">100%</p>
              <p className="mt-1 text-sm text-muted">Privat og skjermet tomt</p>
            </div>
            <div>
              <p className="font-display text-3xl text-brand">0 min</p>
              <p className="mt-1 text-sm text-muted">Til nærmeste turløype</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

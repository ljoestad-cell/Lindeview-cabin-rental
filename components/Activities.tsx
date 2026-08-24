import Image from "next/image";
import { Fish, Footprints, Sailboat, Mountain, Wind, Waves } from "lucide-react";

const activities = [
  {
    icon: Fish,
    title: "Fiske",
    text: "Fiskekort er inkludert i alle opphold — kast snøret i et av de mange vanna rundt hytta.",
    image: "/images/galleri/stemtjonn.jpeg",
    alt: "Stille fjelltjern med bjørk ved bredden, nær Lindeview",
    tag: "Fiskekort inkludert",
  },
  {
    icon: Footprints,
    title: "Turstier",
    text: "Merkede stier rett fra hytta tar deg forbi fossefall og vidder i alle retninger.",
    image: "/images/galleri/waterfall-hike.jpeg",
    alt: "Fossefall langs en av turstiene nær Lindeview",
  },
  {
    icon: Sailboat,
    title: "Kajakkpadling",
    text: "Padle ut på blikkstille vann — perfekt for en rolig morgen eller en lang sommerkveld.",
    image: "/images/galleri/kayak-lake.jpeg",
    alt: "Kajakk på blikkstille vann i nærheten av Lindeview",
  },
  {
    icon: Mountain,
    title: "Klatring",
    text: "Bratte svaberg og utsiktspunkter for deg som vil litt høyere opp.",
    image: "/images/galleri/east-view-no-sheep.png",
    alt: "Svaberg og utsiktspunkt i terrenget rundt Lindeview",
  },
  {
    icon: Wind,
    title: "Paragliding",
    text: "Kjente oppstigningspunkter for paragliding i kort avstand fra hytta.",
    image: "/images/galleri/skavl.jpeg",
    alt: "Dramatisk utsikt fra fjellkanten nær Lindeview",
  },
  {
    icon: Waves,
    title: "Badestrand",
    text: "Forfriskende dukkert i nærmeste vann, kort tur unna hytta.",
    image: "/images/galleri/brua.jpeg",
    alt: "Vann og bro i turterrenget nær Lindeview",
  },
];

export default function Activities() {
  return (
    <section id="aktiviteter" className="mx-auto max-w-7xl px-6 py-24 sm:px-10 sm:py-32">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Aktiviteter
        </p>
        <h2 className="mt-4 font-display text-4xl leading-tight text-brand sm:text-5xl">
          Villmarken er din lekeplass
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-muted">
          Enten du vil ut på vannet, opp i terrenget eller rett og slett bare
          la beina henge over stupet med utsikt — alt ligger innen rekkevidde
          fra Lindeview.
        </p>
      </div>

      <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {activities.map(({ icon: Icon, title, text, image, alt, tag }) => (
          <div
            key={title}
            className="group overflow-hidden rounded-2xl bg-surface ring-1 ring-line"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={image}
                alt={alt}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              />
              {tag && (
                <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-brand">
                  {tag}
                </span>
              )}
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2.5">
                <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
                <p className="font-display text-xl text-brand">{title}</p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

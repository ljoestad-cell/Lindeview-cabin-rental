import Image from "next/image";
import {
  ChefHat,
  Flame,
  Wifi,
  Wind,
  Mountain,
  Car,
} from "lucide-react";

const features = [
  {
    icon: ChefHat,
    title: "Stort gourmetkjøkken",
    text: "Kokeøy, induksjon og alt du trenger for å lage middag på høyt nivå.",
  },
  {
    icon: Flame,
    title: "Peis og vedovn",
    text: "Åpen ild i både stue og kjøkkenkrok gjennom hele året.",
  },
  {
    icon: Mountain,
    title: "Panoramavinduer",
    text: "Vinduer fra gulv til mønet, med utsikt over daler og fjell.",
  },
  {
    icon: Wind,
    title: "Stille og skjermet",
    text: "Ingen naboer tett på, og ingen trafikkstøy å forholde deg til.",
  },
  {
    icon: Wifi,
    title: "Høyhastighets WiFi",
    text: "Koble av — eller på, hvis du trenger det — med solid dekning.",
  },
  {
    icon: Car,
    title: "Parkering på tunet",
    text: "Kjør helt frem, med god plass til flere biler.",
  },
];

export default function Amenities() {
  return (
    <section id="fasiliteter" className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div className="relative overflow-hidden rounded-2xl">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src="/images/galleri/kitchen-dining-fireplace.jpeg"
                alt="Gourmetkjøkken med kokeøy, spisebord og vedovn i Lindeview"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 45vw, 100vw"
              />
            </div>
            <div className="relative mt-4 aspect-[16/10] w-full overflow-hidden rounded-2xl">
              <Image
                src="/images/galleri/living-room-view.jpeg"
                alt="Stue med panoramavindu og utsikt mot solnedgang over fjellet"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 45vw, 100vw"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
              Fasiliteter
            </p>
            <h2 className="mt-4 font-display text-4xl leading-tight text-brand sm:text-5xl">
              Høy standard, midt i villmarka
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              Lindeview er bygget for gjester som vil ha det beste fra begge
              verdener — den rå, uberørte naturen utenfor døra, og en hytte
              innredet med samme standard som du forventer av et eksklusivt
              opphold.
            </p>

            <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/5">
                    <Icon className="h-5 w-5 text-brand" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

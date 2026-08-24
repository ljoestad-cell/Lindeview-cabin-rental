import Image from "next/image";

const photos = [
  {
    src: "/images/galleri/cabin-front-wide.jpeg",
    alt: "Lindeview sett fra siden, med sol og gressplen",
    className: "sm:col-span-2 sm:row-span-2",
  },
  {
    src: "/images/galleri/living-room-view.jpeg",
    alt: "Stue med panoramavindu mot solnedgang",
    className: "",
  },
  {
    src: "/images/galleri/master-bedroom.jpeg",
    alt: "Hovedsoverom med panelvegger",
    className: "",
  },
  {
    src: "/images/galleri/kitchen-dining-fireplace.jpeg",
    alt: "Gourmetkjøkken med spisebord og vedovn",
    className: "sm:row-span-2",
  },
  {
    src: "/images/galleri/cabin-northern-lights.jpeg",
    alt: "Lindeview en vinternatt under nordlys og stjernehimmel",
    className: "",
  },
  {
    src: "/images/galleri/kayak-lake.jpeg",
    alt: "Kajakk på stille vann",
    className: "",
  },
  {
    src: "/images/galleri/hall-1.jpeg",
    alt: "Inngangsparti på Lindeview",
    className: "",
  },
  {
    src: "/images/galleri/waterfall-hike.jpeg",
    alt: "Fossefall langs turstien",
    className: "sm:col-span-2",
  },
  {
    src: "/images/galleri/stemtjonn.jpeg",
    alt: "Fjelltjern nær hytta, godt egnet for fiske",
    className: "",
  },
];

export default function Gallery() {
  return (
    <section id="galleri" className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
              Galleri
            </p>
            <h2 className="mt-4 font-display text-4xl leading-tight text-brand sm:text-5xl">
              Et innblikk i Lindeview
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Flere bilder og en fullstendig omvisning kommer snart. Ta kontakt
            for flere bilder i mellomtiden.
          </p>
        </div>

        <div className="mt-14 grid auto-rows-[220px] grid-cols-2 gap-4 sm:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.src}
              className={`relative overflow-hidden rounded-xl ${photo.className}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                className="object-cover transition-transform duration-500 hover:scale-105"
                sizes="(min-width: 640px) 25vw, 50vw"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
    className: "sm:col-span-2",
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
    className: "sm:row-span-2",
  },
  {
    src: "/images/galleri/east-view-no-sheep.png",
    alt: "Svaberg og utsiktspunkt i terrenget rundt Lindeview",
    className: "",
  },
  {
    src: "/images/galleri/main-bathroom.avif",
    alt: "Hovedbad på Lindeview",
    className: "",
  },
  {
    src: "/images/galleri/loft-living-room.jpeg",
    alt: "Loftsstue med sofa og TV",
    className: "sm:col-span-2 sm:row-span-2",
  },
  {
    src: "/images/galleri/dansk.jpeg",
    alt: "Fjelltjern omgitt av furuskog i nærheten av Lindeview",
    className: "",
  },
  {
    src: "/images/galleri/hall-2.jpeg",
    alt: "Hall med trapp og inngangsparti",
    className: "",
  },
  {
    src: "/images/galleri/living-room-gable.jpeg",
    alt: "Stue med peisovn og gavlvegg",
    className: "sm:col-span-2",
  },
  {
    src: "/images/galleri/bedroom-2.jpeg",
    alt: "Soverom 2 med skrivebord ved vinduet",
    className: "",
  },
  {
    src: "/images/galleri/bedroom-3.avif",
    alt: "Soverom 3 på Lindeview",
    className: "sm:row-span-2",
  },
  {
    src: "/images/galleri/bedroom-4.jpeg",
    alt: "Soverom 4 på hemsen",
    className: "",
  },
];

export default function Gallery() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activePhoto = activeIndex !== null ? photos[activeIndex] : null;

  useEffect(() => {
    if (activeIndex === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveIndex(null);
    }
    document.addEventListener("keydown", handleKeyDown);

    // Hindre bakgrunnen fra å scrolle mens lightboxen er åpen (viktig på mobil).
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeIndex]);

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
        </div>

        <div className="mt-14 grid auto-rows-[220px] grid-cols-2 gap-4 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <button
              key={photo.src}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Vis ${photo.alt} i stort format`}
              className={`relative cursor-zoom-in overflow-hidden rounded-xl ${photo.className}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                className="object-cover transition-transform duration-500 hover:scale-105"
                sizes="(min-width: 640px) 25vw, 50vw"
              />
            </button>
          ))}
        </div>
      </div>

      {activePhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 sm:p-12"
          onClick={() => setActiveIndex(null)}
        >
          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            aria-label="Lukk bilde"
            className="fixed right-4 top-4 rounded-full bg-black/40 p-2.5 text-white transition-colors hover:bg-black/60 sm:right-8 sm:top-8"
          >
            <X className="h-6 w-6" />
          </button>
          <div
            className="relative aspect-[4/3] w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={activePhoto.src}
              alt={activePhoto.alt}
              fill
              className="rounded-xl object-contain"
              sizes="90vw"
            />
          </div>
        </div>
      )}
    </section>
  );
}

import Link from "next/link";
import {
  CONTACT_EMAIL,
  LOCATION_LABEL,
  MAP_QUERY,
  OWNER_NAME,
  OWNER_PHONE_DISPLAY,
  OWNER_PHONE_TEL,
  PROPERTY_NAME,
} from "@/lib/property";

export default function Footer() {
  return (
    <footer className="bg-brand py-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 sm:flex-row sm:items-start sm:justify-between sm:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-2xl text-white">{PROPERTY_NAME}</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/60">
              Eksklusiv villmarkshytte på {LOCATION_LABEL} — stillhet, natur og høy
              standard, samlet på ett sted.
            </p>
          </div>
          <div className="h-56 w-80 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15">
            <iframe
              src={`https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&z=14&t=k&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Kart over ${MAP_QUERY}`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm text-white/70">
          <p className="font-medium text-white">Kontakt</p>
          <p>{OWNER_NAME}</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white">
            {CONTACT_EMAIL}
          </a>
          <a href={`tel:${OWNER_PHONE_TEL}`} className="hover:text-white">
            {OWNER_PHONE_DISPLAY}
          </a>
          <p>{LOCATION_LABEL}</p>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 pt-6 text-xs text-white/40 sm:px-10">
        <span>© {new Date().getFullYear()} {PROPERTY_NAME}. Alle rettigheter forbeholdt.</span>
        <span className="flex gap-5">
          <Link href="/vilkar" className="hover:text-white">
            Leievilkår
          </Link>
          <Link href="/personvern" className="hover:text-white">
            Personvern
          </Link>
        </span>
      </div>
    </footer>
  );
}

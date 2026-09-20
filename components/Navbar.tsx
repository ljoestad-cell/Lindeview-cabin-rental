"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { PROPERTY_NAME } from "@/lib/property";

const links = [
  { href: "#om", label: "Om hytta" },
  { href: "#fasiliteter", label: "Fasiliteter" },
  { href: "#aktiviteter", label: "Aktiviteter" },
  { href: "#galleri", label: "Galleri" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-6 sm:px-10">
        <a
          href="#"
          className="font-display text-2xl tracking-wide text-white"
        >
          {PROPERTY_NAME}
        </a>
        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/85 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="#bestill"
            className="rounded-full bg-accent px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-accent-dark sm:px-5 sm:text-sm"
          >
            Sjekk tilgjengelighet
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Lukk meny" : "Åpne meny"}
            className="rounded-full p-2 text-white transition-colors hover:bg-white/10 md:hidden"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="mx-4 mb-4 rounded-2xl bg-brand p-2 shadow-xl md:hidden">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-base font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}

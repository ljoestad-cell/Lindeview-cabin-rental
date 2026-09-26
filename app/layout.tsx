import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import { LOCATION_LABEL, PROPERTY_NAME } from "@/lib/property";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: `${PROPERTY_NAME} | Eksklusiv villmarkshytte på ${LOCATION_LABEL}`,
  description: `${PROPERTY_NAME} er en eksklusiv villmarkshytte på ${LOCATION_LABEL} — fredelig beliggenhet, gourmetkjøkken og fiskekort inkludert. Book din neste hyttetur.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="no"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}

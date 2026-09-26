import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Amenities from "@/components/Amenities";
import Activities from "@/components/Activities";
import Gallery from "@/components/Gallery";
import Testimonials from "@/components/Testimonials";
import BookingCta from "@/components/BookingCta";
import Footer from "@/components/Footer";
import {
  AIRBNB_URL,
  BATHROOMS,
  BEDROOMS,
  CONTACT_EMAIL,
  GUEST_CAPACITY,
  LOCATION_LABEL,
  OWNER_PHONE_TEL,
  PROPERTY_NAME,
} from "@/lib/property";
import { siteUrl } from "@/lib/site";

/** Strukturerte data (schema.org) så søkemotorer forstår at dette er et utleiested. */
function lodgingJsonLd() {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name: PROPERTY_NAME,
    url,
    image: [`${url}/images/galleri/cabin-front-wide.jpeg`, `${url}/images/galleri/living-room-view.jpeg`],
    telephone: OWNER_PHONE_TEL,
    email: CONTACT_EMAIL,
    address: { "@type": "PostalAddress", addressLocality: LOCATION_LABEL, addressCountry: "NO" },
    sameAs: [AIRBNB_URL],
    containsPlace: {
      "@type": "Accommodation",
      occupancy: { "@type": "QuantitativeValue", maxValue: GUEST_CAPACITY },
      numberOfBedrooms: BEDROOMS,
      numberOfBathroomsTotal: BATHROOMS,
    },
  };
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(lodgingJsonLd()).replace(/</g, "\\u003c") }}
      />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <About />
        <Amenities />
        <Activities />
        <Gallery />
        <Testimonials />
        <BookingCta />
      </main>
      <Footer />
    </>
  );
}

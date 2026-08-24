import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Amenities from "@/components/Amenities";
import Activities from "@/components/Activities";
import Gallery from "@/components/Gallery";
import Testimonials from "@/components/Testimonials";
import BookingCta from "@/components/BookingCta";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
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

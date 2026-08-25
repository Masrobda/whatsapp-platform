import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Services from '@/components/Services';
import WhatsAppAPI from '@/components/WhatsAppAPI';
import Features from '@/components/Features';
import Testimonials from '@/components/Testimonials';
import FAQ from '@/components/FAQ';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Services />
      <WhatsAppAPI />
      <Features />
      <Testimonials />
      <FAQ />
      <Contact />
      <Footer />
    </main>
  );
}

import Header from './components/Header'
import Hero from './components/Hero'
import Marquee from './components/Marquee'
import EraCarousel from './components/EraCarousel'
import Services from './components/Services'
import Work from './components/Work'
import Process from './components/Process'
import Audiences from './components/Audiences'
import Contact from './components/Contact'
import Footer from './components/Footer'
import useParallax from './hooks/useParallax'
import { settings } from './site.config'

export default function App() {
  useParallax()

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <Header />

      <main>
        <Hero />
        {settings.showMarquee && <Marquee />}
        <EraCarousel />
        <Services />
        {settings.showWork && <Work />}
        <Process />
        <Audiences />
        <Contact />
      </main>

      <Footer />
    </>
  )
}

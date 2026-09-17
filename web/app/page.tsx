import Navbar from "@/components/Navbar"
import Hero from "@/components/Hero"
import Features from "@/components/Features"
import Philosophy from "@/components/Philosophy"
import Protocol from "@/components/Protocol"
import BetaSignup from "@/components/BetaSignup"
import Footer from "@/components/Footer"

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Features />
      <Philosophy />
      <Protocol />
      <BetaSignup />
      <Footer />
    </>
  )
}

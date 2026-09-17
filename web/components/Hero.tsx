"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

gsap.registerPlugin(useGSAP)

// ─── Particle Canvas ─────────────────────────────────────────────

interface ParticleCanvasProps {
  count?: number
}

function ParticleCanvas({ count = 60 }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()

    const particleCount = typeof window !== "undefined" && window.innerWidth < 768 ? 30 : count
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random() * 0.06 + 0.01,
    }))

    let rafId: number

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        p.x = (p.x + p.vx + canvas.width) % canvas.width
        p.y = (p.y + p.vy + canvas.height) % canvas.height
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(240,246,255,${p.a})`
        ctx.fill()
      }
      rafId = requestAnimationFrame(tick)
    }

    tick()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [count])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  )
}

// ─── Hero ──────────────────────────────────────────────────────────

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const h1Ref = useRef<HTMLHeadingElement>(null)
  const dramRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLParagraphElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      gsap.fromTo(
        [h1Ref.current, dramRef.current, subRef.current, ctaRef.current],
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          delay: 0.4,
          duration: 1.1,
          ease: "power3.out",
        }
      )
    },
    { scope: sectionRef }
  )

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative overflow-hidden bg-[#050A14]"
      style={{ height: "100dvh" }}
    >
      {/* Space background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=80')",
        }}
        aria-hidden="true"
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, #050A14 0%, rgba(5,10,20,0.85) 40%, rgba(5,10,20,0.5) 70%, rgba(5,10,20,0.25) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Particles */}
      <ParticleCanvas count={60} />

      {/* Content — bottom-left */}
      <div
        className="absolute flex flex-col items-start"
        style={{
          bottom: "clamp(1.5rem, 15vh, 8rem)",
          left: "clamp(1.5rem, 8vw, 6rem)",
          maxWidth: "min(720px, calc(100vw - 3rem))",
        }}
      >
        <h1
          ref={h1Ref}
          className="text-[#F0F6FF] leading-[1.05] tracking-[-0.02em]"
          style={{
            fontFamily: "var(--font-sora)",
            fontWeight: 700,
            fontSize: "clamp(2rem, min(7vw, 8vh), 5.5rem)",
          }}
        >
          Learning in pieces.
        </h1>

        <div ref={dramRef} className="mt-1 leading-[1.0]">
          <span
            className="text-glow-cyan"
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontStyle: "italic",
              fontSize: "clamp(2.5rem, min(9vw, 10vh), 7rem)",
              color: "#00D4FF",
              display: "block",
              lineHeight: 1.05,
            }}
          >
            Understanding as a whole.
          </span>
        </div>

        <p
          ref={subRef}
          className="mt-4 lg:mt-7 text-[#CBD5E0] leading-[1.7]"
          style={{
            fontFamily: "var(--font-sora)",
            fontSize: "clamp(0.9rem, 2vh, 1.125rem)",
            maxWidth: "560px",
          }}
        >
          Astryon breaks content into atomic concepts, then synthesizes them
          into a living knowledge graph. Stop consuming. Start constructing.
        </p>

        <div ref={ctaRef} className="mt-5 lg:mt-8 flex flex-wrap items-center gap-4">
          <a
            href="#beta"
            className="btn-gradient text-white px-8 py-3.5 rounded-full text-base"
            style={{ fontFamily: "var(--font-sora)", fontWeight: 600 }}
          >
            Join the Beta
          </a>
          <a
            href="#how-it-works"
            className="text-base hover:opacity-80 transition-opacity duration-200"
            style={{ fontFamily: "var(--font-sora)", fontWeight: 500, color: "#00D4FF" }}
          >
            See How It Works →
          </a>
        </div>
      </div>
    </section>
  )
}

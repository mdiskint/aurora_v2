"use client"

import { useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(useGSAP, ScrollTrigger)

export default function Philosophy() {
  const sectionRef = useRef<HTMLElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)
  const line1Ref = useRef<HTMLDivElement>(null)
  const line2Ref = useRef<HTMLDivElement>(null)
  const line3Ref = useRef<HTMLDivElement>(null)
  const line4Ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      // Parallax background
      gsap.to(bgRef.current, {
        yPercent: 30,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      })

      // Stagger fade-up for all 4 lines
      const lines = [
        line1Ref.current,
        line2Ref.current,
        line3Ref.current,
        line4Ref.current,
      ]
      gsap.fromTo(
        lines,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            toggleActions: "play none none reverse",
          },
        }
      )

      // Glow intensify on final line
      ScrollTrigger.create({
        trigger: line4Ref.current,
        start: "top 60%",
        onEnter: () => {
          gsap.to(line4Ref.current, {
            filter: "brightness(1.4)",
            textShadow:
              "0 0 40px rgba(0,212,255,0.8), 0 0 80px rgba(0,212,255,0.4)",
            duration: 1,
            delay: 0.5,
            ease: "power2.inOut",
          })
        },
      })
    },
    { scope: sectionRef }
  )

  return (
    <section
      ref={sectionRef}
      id="synthesis"
      className="relative overflow-hidden py-36"
      style={{ background: "#0A1F44" }}
    >
      {/* Parallax background image */}
      <div
        ref={bgRef}
        className="absolute inset-0 scale-110 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1518818608552-195ed130cdf4?auto=format&fit=crop&w=1920&q=80')",
          opacity: 0.08,
        }}
        aria-hidden="true"
      />
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(10,31,68,0.7)" }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Mono label */}
        <div
          className="mb-10 uppercase tracking-widest"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: "0.75rem",
            color: "#00D4FF",
            fontWeight: 500,
          }}
        >
          {"// PHILOSOPHY"}
        </div>

        <div className="space-y-3">
          <div
            ref={line1Ref}
            style={{
              fontFamily: "var(--font-sora)",
              fontSize: "1.25rem",
              color: "#4A5568",
            }}
          >
            Most online learning platforms focus on:
          </div>
          <div ref={line2Ref}>
            <span
              className="line-through decoration-[#4A5568]/50"
              style={{
                fontFamily: "var(--font-sora)",
                fontSize: "1.25rem",
                color: "#4A5568",
              }}
            >
              content delivery.
            </span>
          </div>
          <div
            ref={line3Ref}
            className="pt-8"
            style={{
              fontFamily: "var(--font-sora)",
              fontSize: "1.25rem",
              color: "#4A5568",
            }}
          >
            Astryon focuses on:
          </div>
          <div ref={line4Ref} className="text-glow-cyan" style={{ display: "block" }}>
            <span
              style={{
                fontFamily: "var(--font-instrument-serif)",
                fontStyle: "italic",
                fontSize: "clamp(3rem, 6vw, 5rem)",
                color: "#00D4FF",
                display: "block",
                lineHeight: 1.1,
              }}
            >
              knowledge construction.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

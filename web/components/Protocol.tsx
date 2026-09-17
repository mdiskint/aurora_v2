"use client"

import { useRef, useState, useEffect } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(useGSAP, ScrollTrigger)

const RING_NODE_COLOR = "#00D4FF"
const GRID_LASER_COLOR = "#8B5CF6"
const EKG_COLOR = "#E040FB"

function RotatingRingCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let rotation = 0
    let rafId = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      const cx = w / 2
      const cy = h / 2
      const breathe = 0.99 + 0.01 * Math.sin(Date.now() * 0.001)
      const r = Math.min(cx, cy) * 0.65 * breathe

      ctx.clearRect(0, 0, w, h)

      const nodeCount = 12
      const nodes = Array.from({ length: nodeCount }, (_, i) => {
        const angle = (i / nodeCount) * Math.PI * 2 + rotation

        return {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        }
      })

      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(0,212,255,0.08)"
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.strokeStyle = "rgba(0,212,255,0.2)"
      ctx.lineWidth = 0.5
      for (let i = 0; i < nodeCount; i += 1) {
        const a = nodes[i]
        const b = nodes[(i + 1) % nodeCount]

        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      for (let i = 0; i < nodeCount; i += 1) {
        const a = nodes[i]
        const b = nodes[(i + 6) % nodeCount]

        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.strokeStyle = "rgba(0,212,255,0.1)"
        ctx.stroke()
      }

      nodes.forEach((node, index) => {
        const pulse = 0.8 + 0.4 * Math.sin(Date.now() * 0.002 + index)

        ctx.shadowColor = RING_NODE_COLOR
        ctx.shadowBlur = 8 * pulse
        ctx.fillStyle = RING_NODE_COLOR
        ctx.beginPath()
        ctx.arc(node.x, node.y, 2.5 + pulse * 0.7, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      })

      rotation += (8 / 60) * ((2 * Math.PI) / 60)
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className ?? ""}`}
      aria-hidden="true"
    />
  )
}

function ScannerGrid() {
  const [laserCol, setLaserCol] = useState(0)
  const [activeCols, setActiveCols] = useState<Set<number>>(new Set())
  const [doneCols, setDoneCols] = useState<Set<number>>(new Set())
  const timeoutIdsRef = useRef<number[]>([])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLaserCol((prev) => {
        const next = (prev + 1) % 6

        setActiveCols((current) => new Set([...current, next]))

        const activeTimeout = window.setTimeout(() => {
          setActiveCols((current) => {
            const updated = new Set(current)
            updated.delete(next)

            return updated
          })

          setDoneCols((current) => {
            const updated = new Set([...current, next])

            if (updated.size >= 6) {
              const clearDoneTimeout = window.setTimeout(() => {
                setDoneCols(new Set())
              }, 1000)
              timeoutIdsRef.current.push(clearDoneTimeout)
            }

            return updated
          })
        }, 600)

        timeoutIdsRef.current.push(activeTimeout)

        return next
      })
    }, 200)

    return () => {
      window.clearInterval(interval)
      timeoutIdsRef.current.forEach((id) => window.clearTimeout(id))
      timeoutIdsRef.current = []
    }
  }, [])

  const cellWidth = 100 / 6

  return (
    <div className="relative overflow-hidden w-full">
      <div
        className="absolute top-0 h-full w-[2px] z-10 transition-all duration-200"
        style={{
          left: `${laserCol * cellWidth + cellWidth / 2}%`,
          background: GRID_LASER_COLOR,
          boxShadow: "0 0 8px #8B5CF6, 0 0 16px rgba(139,92,246,0.4)",
        }}
      />

      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {Array.from({ length: 24 }, (_, index) => {
          const col = index % 6
          const isActive = activeCols.has(col)
          const isDone = doneCols.has(col)

          const border = isDone
            ? "1px solid rgba(16,185,129,0.4)"
            : isActive
              ? "1px solid #8B5CF6"
              : "1px solid rgba(30,58,95,0.4)"

          const background = isDone
            ? "rgba(16,185,129,0.1)"
            : isActive
              ? "rgba(139,92,246,0.2)"
              : "transparent"

          return (
            <div
              key={index}
              className="h-8 transition-all duration-300"
              style={{
                border,
                background,
                boxShadow: isActive ? "0 0 8px rgba(139,92,246,0.4)" : "none",
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function EKGWaveform() {
  const pathRef = useRef<SVGPathElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const path = pathRef.current
      if (!path) return

      const length = path.getTotalLength()

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 })
      tl.set(path, { strokeDasharray: length, strokeDashoffset: length })
      tl.to(path, {
        strokeDashoffset: 0,
        duration: 1.5,
        ease: "power2.inOut",
      })
    },
    { scope: containerRef }
  )

  return (
    <div ref={containerRef} className="w-full flex items-center">
      <svg
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        className="w-full h-16"
        aria-hidden="true"
      >
        <defs>
          <filter id="ekg-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path d="M 0,50 L 400,50" stroke="#E040FB" strokeWidth="1" fill="none" opacity="0.3" />

        <path
          ref={pathRef}
          d="M 0,50 L 60,50 Q 70,30 80,50 L 100,50 L 120,50 L 130,10 L 140,90 L 150,50 L 200,50 Q 220,20 240,50 L 400,50"
          stroke={EKG_COLOR}
          strokeWidth="1.5"
          fill="none"
          filter="url(#ekg-glow)"
        />
      </svg>
    </div>
  )
}

export default function Protocol() {
  const sectionRef = useRef<HTMLElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const cardsContainerRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const cards = cardsContainerRef.current?.querySelectorAll(".protocol-card")
      if (!cards?.length) return

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 70%",
          toggleActions: "play none none reverse",
        },
      })

      tl.fromTo(
        labelRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }
      )

      tl.fromTo(
        Array.from(cards),
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.15, duration: 0.7, ease: "power3.out" },
        "-=0.2"
      )
    },
    { scope: sectionRef }
  )

  const cardContent = [
    {
      step: "01",
      title: "Break It Down",
      body: "Every concept atomized into its smallest meaningful unit.",
      accent: "cyan" as const,
      animation: (
        <div className="w-full h-full">
          <RotatingRingCanvas />
        </div>
      ),
    },
    {
      step: "02",
      title: "Work With Each Piece",
      body: "Engage with each atom through the Leopold method.",
      accent: "purple" as const,
      animation: <ScannerGrid />,
    },
    {
      step: "03",
      title: "Build Something Bigger",
      body: "Synthesize atoms into a living knowledge constellation.",
      accent: "pink" as const,
      animation: <EKGWaveform />,
    },
  ]

  const accentMap = {
    cyan: { color: "#00D4FF", borderColor: "rgba(0,212,255,0.15)", glowColor: "rgba(0,212,255,0.06)" },
    purple: { color: "#8B5CF6", borderColor: "rgba(139,92,246,0.15)", glowColor: "rgba(139,92,246,0.06)" },
    pink: { color: "#E040FB", borderColor: "rgba(224,64,251,0.15)", glowColor: "rgba(224,64,251,0.06)" },
  }

  return (
    <section
      ref={sectionRef}
      id="the-framework"
      className="relative bg-[#050A14] py-24 px-6"
    >
      <div className="max-w-6xl mx-auto">
        <div
          ref={labelRef}
          className="mb-16 text-center uppercase tracking-widest"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: "0.75rem",
            color: "#00D4FF",
            fontWeight: 500,
          }}
        >
          {"// THE PROTOCOL"}
        </div>

        <div
          ref={cardsContainerRef}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {cardContent.map((card) => {
            const accent = accentMap[card.accent]
            return (
              <div
                key={card.step}
                className="protocol-card flex flex-col rounded-2xl p-6 border"
                style={{
                  background: accent.glowColor,
                  borderColor: accent.borderColor,
                  backdropFilter: "blur(8px)",
                }}
              >
                <div className="mb-6 h-48 flex items-center justify-center overflow-hidden">
                  {card.animation}
                </div>

                <div className="mt-auto pt-4 border-t" style={{ borderColor: accent.borderColor }}>
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontSize: "0.75rem",
                      color: accent.color,
                      letterSpacing: "0.2em",
                    }}
                  >
                    {card.step}
                  </span>
                  <h3
                    style={{
                      fontFamily: "var(--font-sora)",
                      fontWeight: 700,
                      fontSize: "clamp(1.25rem, 2vw, 1.5rem)",
                      color: "#F0F6FF",
                      marginTop: "0.5rem",
                      lineHeight: 1.1,
                    }}
                  >
                    {card.title}
                  </h3>
                  <p
                    style={{
                      color: "#4A5568",
                      marginTop: "0.75rem",
                      lineHeight: 1.6,
                      fontFamily: "var(--font-sora)",
                      fontSize: "0.9rem",
                    }}
                  >
                    {card.body}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

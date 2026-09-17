"use client"

import { useEffect, useRef, useState } from "react"

function ParticleCanvas({ count = 60 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const particleCount =
      typeof window !== "undefined" && window.innerWidth < 768 ? 30 : count

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    type Particle = {
      x: number
      y: number
      vx: number
      vy: number
      r: number
      opacity: number
    }

    const particles: Particle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.06 + 0.01,
    }))

    let rafId: number

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        p.x = (p.x + p.vx + canvas.width) % canvas.width
        p.y = (p.y + p.vy + canvas.height) % canvas.height
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${p.opacity})`
        ctx.fill()
      })
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)

    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [count])

  return (
    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
  )
}

const inputStyle = {
  background: "#0A1F44",
  border: "1px solid #1E3A5F",
  color: "#F0F6FF",
  outline: "none",
}

const focusStyle = { borderColor: "#00D4FF", boxShadow: "0 0 8px rgba(0,212,255,0.4)" }
const blurStyle = { borderColor: "#1E3A5F", boxShadow: "none" }

export default function BetaSignup() {
  const [email, setEmail] = useState("")
  const [learningGoal, setLearningGoal] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("loading")
    try {
      const res = await fetch(`/api/beta-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, learningGoal }),
      })
      if (res.ok) {
        setStatus("success")
      } else {
        const data = await res.json()
        setErrorMsg(data.error ?? "Something went wrong.")
        setStatus("error")
      }
    } catch {
      setErrorMsg("Could not connect. Please try again.")
      setStatus("error")
    }
  }

  return (
    <section
      id="beta"
      className="relative overflow-hidden bg-[#050A14] px-6"
      style={{ paddingTop: "15vh", paddingBottom: "15vh" }}
    >
      <ParticleCanvas count={30} />

      <div className="relative z-10 mx-auto max-w-xl text-center">
        <p
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: "0.75rem",
            color: "#00D4FF",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: "1.5rem",
          }}
        >
          {"// EARLY ACCESS"}
        </p>

        <h2
          style={{
            fontFamily: "var(--font-sora)",
            fontWeight: 700,
            fontSize: "clamp(2rem,5vw,4rem)",
            color: "#F0F6FF",
            lineHeight: 1.1,
          }}
        >
          Ready to build
        </h2>
        <h2
          className="text-glow-cyan"
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontStyle: "italic",
            fontSize: "clamp(2rem,5vw,4rem)",
            color: "#00D4FF",
            lineHeight: 1.1,
            marginBottom: "1.5rem",
          }}
        >
          understanding that sticks?
        </h2>

        <p
          style={{
            fontSize: "1.125rem",
            color: "#CBD5E0",
            maxWidth: "520px",
            margin: "0 auto 2.5rem",
            lineHeight: 1.7,
          }}
        >
          Astryon is in beta. Join educators and learners who are building expertise the right
          way — piece by piece, concept by concept.
        </p>

        {status === "success" ? (
          <p style={{ color: "#00D4FF", fontSize: "1.125rem" }}>
            Check your inbox — your invite is on the way.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm transition-all duration-200"
              style={inputStyle}
              onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)}
            />

            <input
              type="text"
              placeholder="What do you want to learn?"
              value={learningGoal}
              onChange={(e) => setLearningGoal(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm transition-all duration-200"
              style={inputStyle}
              onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
              onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)}
            />

            {status === "error" && (
              <p style={{ color: "#FC8181", fontSize: "0.875rem" }}>{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="btn-gradient mt-2 w-full rounded-full px-10 py-4 text-white disabled:opacity-60"
              style={{ fontFamily: "var(--font-sora)", fontWeight: 600 }}
            >
              {status === "loading" ? "Sending…" : "Join the Beta"}
            </button>
          </form>
        )}

        <p style={{ color: "#4A5568", fontSize: "0.875rem", marginTop: "1rem" }}>
          No credit card. No pressure. Just better learning.
        </p>
      </div>
    </section>
  )
}

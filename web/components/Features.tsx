"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(useGSAP, ScrollTrigger)

function MonoLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        fontSize: "0.75rem",
        color: "#00D4FF",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
      }}
    >
      {children}
    </span>
  )
}

type Phase = "whole" | "splitting" | "grid"

interface Segment {
  label: string
  color: string
}

const segments: Segment[] = [
  { label: "Spaced Repetition", color: "#00D4FF" },
  { label: "Schema Theory", color: "#8B5CF6" },
  { label: "Retrieval Effect", color: "#E040FB" },
  { label: "Interleaving", color: "#00FFD1" },
]

const splitPositions = [
  { x: -120, y: -60 },
  { x: 120, y: -60 },
  { x: -120, y: 60 },
  { x: 120, y: 60 },
]

const gridPositions = [
  { x: -60, y: -30 },
  { x: 60, y: -30 },
  { x: -60, y: 30 },
  { x: 60, y: 30 },
]

function AtomizerCard() {
  const [phase, setPhase] = useState<Phase>("whole")
  const timeoutsRef = useRef<number[]>([])

  useEffect(() => {
    const clearScheduled = () => {
      for (const timeoutId of timeoutsRef.current) {
        window.clearTimeout(timeoutId)
      }
      timeoutsRef.current = []
    }

    const schedule = (callback: () => void, delay: number) => {
      const timeoutId = window.setTimeout(callback, delay)
      timeoutsRef.current.push(timeoutId)
      return timeoutId
    }

    const runCycle = () => {
      setPhase("whole")
      schedule(() => {
        setPhase("splitting")
        schedule(() => {
          setPhase("grid")
          schedule(runCycle, 1800)
        }, 800)
      }, 1000)
    }

    runCycle()

    return () => {
      clearScheduled()
    }
  }, [])

  return (
    <article className="rounded-[2rem] border border-[#00D4FF]/20 bg-[#0A1F44] p-6">
      <div className="flex items-center justify-between">
        <MonoLabel>Atomization</MonoLabel>
      </div>

      <h3
        className="mt-2 text-[#F0F6FF]"
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 600,
          fontSize: "1.5rem",
          lineHeight: 1.2,
        }}
      >
        Break It Down
      </h3>

      <p
        className="mt-2 text-[#CBD5E0]"
        style={{
          fontFamily: "var(--font-sora)",
          fontSize: "0.95rem",
          lineHeight: 1.6,
        }}
      >
        Dense lessons atomize into learnable concepts, then reassemble into mastery.
      </p>

      <div className="h-52 relative flex items-center justify-center overflow-hidden mt-5">
        {phase === "whole" ? (
          <div
            className="w-64 h-10 rounded-xl flex items-center justify-center"
            style={{
              border: "1px solid rgba(0, 212, 255, 0.45)",
              background:
                "linear-gradient(135deg, rgba(0, 212, 255, 0.18), rgba(139, 92, 246, 0.16), rgba(224, 64, 251, 0.16))",
              boxShadow: "0 0 18px rgba(0, 212, 255, 0.25)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: "0.8rem",
                color: "#F0F6FF",
                letterSpacing: "0.03em",
              }}
            >
              90-min lecture
            </span>
          </div>
        ) : (
          segments.map((segment, index) => {
            const target = phase === "splitting" ? splitPositions[index] : gridPositions[index]

            return (
              <div
                key={segment.label}
                className="absolute px-3 py-1.5 rounded-xl text-xs"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: segment.color,
                  background: `${segment.color}18`,
                  border: `1px solid ${segment.color}50`,
                  boxShadow: `0 0 8px ${segment.color}40`,
                  transform: `translate(${target.x}px, ${target.y}px)`,
                  transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  letterSpacing: "0.02em",
                }}
              >
                {segment.label}
              </div>
            )
          })
        )}
      </div>
    </article>
  )
}

const stages = [
  { label: "L1", name: "Intuition", desc: "A concrete example that makes it click." },
  { label: "L2", name: "Model", desc: "The expert reasoning pattern, laid out." },
  { label: "L3", name: "Imitate", desc: "Apply the pattern yourself." },
  { label: "L4", name: "Quiz", desc: "Test whether you actually understood." },
  { label: "L5", name: "Synthesis", desc: "Connect it to everything else you know." },
]

function LeopoldCard() {
  const [activeStage, setActiveStage] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveStage((prev) => (prev + 1) % stages.length)
    }, 2000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <article className="rounded-[2rem] border border-[#00D4FF]/20 bg-[#0A1F44] p-6 relative overflow-hidden">
      <div
        className="absolute top-5 right-5 flex items-center gap-1.5"
        style={{ color: "#10B981", fontFamily: "var(--font-jetbrains-mono)", fontSize: "0.7rem" }}
      >
        <span
          className="pulse-dot"
          style={{ width: "6px", height: "6px", borderRadius: "9999px", background: "#10B981" }}
        />
        <span style={{ letterSpacing: "0.08em" }}>LIVE</span>
      </div>

      <MonoLabel>Leopold Layers</MonoLabel>

      <h3
        className="mt-2 text-[#F0F6FF]"
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 600,
          fontSize: "1.5rem",
          lineHeight: 1.2,
        }}
      >
        Five Ways to Master It
      </h3>

      <div className="mt-4 flex gap-1.5 flex-wrap">
        {stages.map((stage, index) => {
          const isActive = index === activeStage

          return (
            <button
              key={stage.label}
              type="button"
              onClick={() => setActiveStage(index)}
              className="rounded-full px-3 py-1.5 text-xs transition-all duration-300"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                background: isActive ? "#00D4FF" : "transparent",
                color: isActive ? "#050A14" : "#4A5568",
                border: isActive ? "1px solid transparent" : "1px solid #1E3A5F",
                fontWeight: isActive ? 700 : 500,
                boxShadow: isActive ? "0 0 14px rgba(0, 212, 255, 0.5)" : "none",
                cursor: "pointer",
              }}
            >
              {stage.label}
            </button>
          )
        })}
      </div>

      <div
        className="mt-5 rounded-2xl border border-[#1E3A5F] bg-[#081731] p-4 min-h-32"
        style={{ boxShadow: "inset 0 0 0 1px rgba(0, 212, 255, 0.05)" }}
      >
        <p
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: "0.75rem",
            color: "#8B5CF6",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {stages[activeStage].name}
        </p>

        <p
          className="mt-3 text-[#F0F6FF]"
          style={{
            fontFamily: "var(--font-sora)",
            fontSize: "0.95rem",
            lineHeight: 1.6,
          }}
        >
          <TypewriterText key={activeStage} text={stages[activeStage].desc} />
        </p>
      </div>
    </article>
  )
}

function TypewriterText({ text }: { text: string }) {
  const [typed, setTyped] = useState("")

  useEffect(() => {
    let charIndex = 0
    const typeIntervalId = window.setInterval(() => {
      charIndex += 1
      setTyped(text.slice(0, charIndex))

      if (charIndex >= text.length) {
        window.clearInterval(typeIntervalId)
      }
    }, 28)

    return () => {
      window.clearInterval(typeIntervalId)
    }
  }, [text])

  const typing = typed.length < text.length

  return (
    <>
      {typed}
      {typing ? (
        <span className="blink" style={{ color: "#00D4FF" }}>
          |
        </span>
      ) : null}
    </>
  )
}

type Cluster = "cyan" | "purple" | "pink"

interface ConstellationNode {
  id: number
  x: number
  y: number
  cluster: Cluster
  label: string
}

interface Connection {
  from: number
  to: number
}

const nodes: ConstellationNode[] = [
  { id: 0, x: 80, y: 60, cluster: "cyan", label: "Memory" },
  { id: 1, x: 200, y: 40, cluster: "purple", label: "Focus" },
  { id: 2, x: 320, y: 70, cluster: "pink", label: "Recall" },
  { id: 3, x: 60, y: 140, cluster: "cyan", label: "Schema" },
  { id: 4, x: 160, y: 120, cluster: "purple", label: "Pattern" },
  { id: 5, x: 280, y: 130, cluster: "pink", label: "Transfer" },
  { id: 6, x: 100, y: 200, cluster: "cyan", label: "Practice" },
  { id: 7, x: 220, y: 190, cluster: "purple", label: "Spacing" },
  { id: 8, x: 340, y: 180, cluster: "pink", label: "Testing" },
  { id: 9, x: 190, y: 160, cluster: "cyan", label: "Synthesis" },
]

const clusterColors: Record<Cluster, string> = {
  cyan: "#00D4FF",
  purple: "#8B5CF6",
  pink: "#E040FB",
}

const connections: Connection[] = [
  { from: 0, to: 4 },
  { from: 1, to: 4 },
  { from: 2, to: 5 },
  { from: 3, to: 6 },
  { from: 4, to: 7 },
  { from: 5, to: 8 },
  { from: 6, to: 9 },
  { from: 7, to: 9 },
  { from: 0, to: 3 },
  { from: 1, to: 5 },
  { from: 2, to: 8 },
  { from: 4, to: 9 },
]

function ConstellationCard() {
  const [visibleNodes, setVisibleNodes] = useState<number[]>([])
  const [visibleConns, setVisibleConns] = useState<number[]>([])
  const nodeIdxRef = useRef(0)
  const resetTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setVisibleNodes((previousVisibleNodes) => {
        if (nodeIdxRef.current >= nodes.length) {
          return previousVisibleNodes
        }

        const nextNodeId = nodes[nodeIdxRef.current].id
        const updatedVisibleNodes = [...previousVisibleNodes, nextNodeId]
        nodeIdxRef.current += 1

        setVisibleConns((previousVisibleConns) => {
          const nextVisibleConns = new Set(previousVisibleConns)

          connections.forEach((connection, connectionIndex) => {
            const hasFrom = updatedVisibleNodes.includes(connection.from)
            const hasTo = updatedVisibleNodes.includes(connection.to)
            if (hasFrom && hasTo) {
              nextVisibleConns.add(connectionIndex)
            }
          })

          return Array.from(nextVisibleConns)
        })

        if (nodeIdxRef.current >= nodes.length) {
          if (resetTimeoutRef.current) {
            window.clearTimeout(resetTimeoutRef.current)
          }

          resetTimeoutRef.current = window.setTimeout(() => {
            nodeIdxRef.current = 0
            setVisibleNodes([])
            setVisibleConns([])
          }, 2000)
        }

        return updatedVisibleNodes
      })
    }, 1500)

    return () => {
      window.clearInterval(intervalId)
      if (resetTimeoutRef.current) {
        window.clearTimeout(resetTimeoutRef.current)
      }
    }
  }, [])

  return (
    <article className="rounded-[2rem] border border-[#00D4FF]/20 bg-[#0A1F44] p-6">
      <MonoLabel>Knowledge Graph</MonoLabel>

      <h3
        className="mt-2 text-[#F0F6FF]"
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 600,
          fontSize: "1.5rem",
          lineHeight: 1.2,
        }}
      >
        Your Knowledge, Connected
      </h3>

      <p
        className="mt-2 text-[#CBD5E0]"
        style={{
          fontFamily: "var(--font-sora)",
          fontSize: "0.95rem",
          lineHeight: 1.6,
        }}
      >
        Concepts stop floating in isolation and become one connected system.
      </p>

      <div className="mt-5 rounded-2xl border border-[#1E3A5F] bg-[#081731] p-3">
        <svg viewBox="0 0 380 240" preserveAspectRatio="xMidYMid meet" className="constellation-svg w-full">
          <defs>
            <filter id="node-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {connections.map((connection, index) => {
            if (!visibleConns.includes(index)) {
              return null
            }

            const fromNode = nodes[connection.from]
            const toNode = nodes[connection.to]
            const color = clusterColors[fromNode.cluster]

            return (
              <line
                key={`${connection.from}-${connection.to}`}
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke={color}
                strokeWidth="0.8"
                opacity="0.5"
              />
            )
          })}

          {nodes.map((node) => {
            if (!visibleNodes.includes(node.id)) {
              return null
            }

            const color = clusterColors[node.cluster]

            return (
              <g key={node.id}>
                <circle cx={node.x} cy={node.y} r={5} fill={color} filter="url(#node-glow)" />
                <text x={node.x + 8} y={node.y + 4} fontSize="9" fill={color} opacity="0.8">
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </article>
  )
}

export default function Features() {
  const containerRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      gsap.from(".feature-card", {
        y: 50,
        opacity: 0,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%",
        },
      })
    },
    { scope: containerRef }
  )

  return (
    <section ref={containerRef} id="how-it-works" className="py-24 px-6 bg-[#050A14]">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <MonoLabel>{"/" + "/ FEATURES"}</MonoLabel>
          <h2
            className="mt-4 text-[#F0F6FF]"
            style={{
              fontFamily: "var(--font-sora)",
              fontWeight: 600,
              fontSize: "clamp(2rem, 4vw, 3.5rem)",
              lineHeight: 1.1,
            }}
          >
            Built to build understanding
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <div className="feature-card">
            <AtomizerCard />
          </div>

          <div className="feature-card">
            <LeopoldCard />
          </div>

          <div className="feature-card">
            <ConstellationCard />
          </div>
        </div>
      </div>
    </section>
  )
}

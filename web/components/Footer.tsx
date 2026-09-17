export default function Footer() {
  return (
    <footer
      id="footer"
      className="bg-[#050A14] rounded-t-[4rem] px-8 md:px-16 pt-16 pb-8 mt-0"
    >
      <div className="max-w-6xl mx-auto">
        {/* 3-col grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">

          {/* Col 1: Brand + status */}
          <div className="flex flex-col gap-4">
            <span style={{ fontFamily: "var(--font-sora)", fontWeight: 700, fontSize: "1.25rem", color: "#F0F6FF" }}>
              Astryon
            </span>
            <p style={{ fontFamily: "var(--font-sora)", color: "#4A5568", fontSize: "0.875rem", lineHeight: 1.6 }}>
              Learning in pieces. Understanding as a whole.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="pulse-dot w-2 h-2 rounded-full bg-[#10B981] inline-block" />
              <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: "0.75rem", color: "#10B981", fontWeight: 500 }}>
                OPERATIONAL
              </span>
              <span style={{ fontFamily: "var(--font-sora)", fontSize: "0.75rem", color: "#4A5568" }}>
                System Operational
              </span>
            </div>
          </div>

          {/* Col 2: Nav links */}
          <div className="flex flex-col gap-3">
            <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: "0.75rem", color: "#00D4FF", fontWeight: 500, letterSpacing: "0.08em" }}>
              NAVIGATION
            </span>
            {["How It Works", "The Framework", "Synthesis", "For Educators", "About"].map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
                style={{ fontFamily: "var(--font-sora)", color: "#4A5568", fontSize: "0.875rem", transition: "color 0.2s" }}
                className="hover:text-[#F0F6FF]"
              >
                {link}
              </a>
            ))}
          </div>

          {/* Col 3: Beta + legal links */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: "0.75rem", color: "#00D4FF", fontWeight: 500, letterSpacing: "0.08em" }}>
                ACCESS
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[0.65rem] font-semibold"
                style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", color: "#00D4FF", fontFamily: "var(--font-jetbrains-mono)" }}
              >
                BETA
              </span>
            </div>
            {["Beta", "Contact", "Privacy", "Terms"].map((link) => (
              <a
                key={link}
                href="#"
                style={{ fontFamily: "var(--font-sora)", color: "#4A5568", fontSize: "0.875rem", transition: "color 0.2s" }}
                className="hover:text-[#F0F6FF]"
              >
                {link}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#0A1F44] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span style={{ fontFamily: "var(--font-sora)", color: "#4A5568", fontSize: "0.875rem" }}>
            © {new Date().getFullYear()} Astryon. All rights reserved.
          </span>
          <span style={{ fontFamily: "var(--font-jetbrains-mono)", color: "#4A5568", fontSize: "0.75rem" }}>
            v0.1.0-beta
          </span>
        </div>
      </div>
    </footer>
  )
}

'use client';

import { useRouter } from 'next/navigation';

export default function Navigation() {
  const router = useRouter();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '70px',
      background: 'linear-gradient(to bottom, rgba(5, 10, 30, 0.95), rgba(5, 10, 30, 0.8))',
      backdropFilter: 'blur(10px)',
      borderBottom: '2px solid rgba(0, 255, 212, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 40px',
      zIndex: 1000,
    }}>
      {/* Left Section - Reserved for Create Nexus button from CanvasScene */}
      <div style={{ flex: '0 0 150px' }}>
        {/* Create Nexus button will appear here from CanvasScene */}
      </div>

      {/* Center Section - Aurora Logo (Absolutely positioned for true centering) */}
      <div
        onClick={() => router.push('/chat')}
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          cursor: 'pointer',
          fontSize: '28px',
          fontWeight: 'bold',
          background: 'linear-gradient(90deg, #00ff87, #60efff, #b967ff, #ff61d8)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '0.15em',
          filter: 'drop-shadow(0 0 15px rgba(96, 239, 255, 0.4)) drop-shadow(0 0 20px rgba(0, 255, 135, 0.3))',
          transition: 'all 0.3s ease',
          userSelect: 'none',
          animation: 'aurora-shimmer 8s ease-in-out infinite',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = 'drop-shadow(0 0 25px rgba(96, 239, 255, 0.6)) drop-shadow(0 0 30px rgba(0, 255, 135, 0.5))';
          e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = 'drop-shadow(0 0 15px rgba(96, 239, 255, 0.4)) drop-shadow(0 0 20px rgba(0, 255, 135, 0.3))';
          e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
        }}
      >
        AURORA
      </div>

      <style jsx>{`
        @keyframes aurora-shimmer {
          0%, 100% { filter: hue-rotate(0deg); }
          50% { filter: hue-rotate(20deg); }
        }
      `}</style>

      {/* Right Section - Memories Button */}
      <div style={{ flex: '0 0 150px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => router.push('/memories')}
          style={{
            padding: '12px 24px',
            background: 'rgba(147, 51, 234, 0.2)',
            border: '2px solid #9333EA',
            borderRadius: '8px',
            color: '#00FFD4',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(147, 51, 234, 0.4)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(147, 51, 234, 0.2)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span style={{ fontSize: '20px' }}>🧠</span>
          Memories
        </button>
      </div>
    </div>
  );
}
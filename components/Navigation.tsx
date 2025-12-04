'use client';

import { useRouter } from 'next/navigation';
import { useCanvasStore } from '@/lib/store';

export default function Navigation() {
  const router = useRouter();
  const enableApplicationLabMode = useCanvasStore((state) => state.enableApplicationLabMode);
  const hasUniverse = useCanvasStore((state) => {
    const activeUniverseId = state.activeUniverseId;
    return activeUniverseId ? Object.keys(state.universeLibrary[activeUniverseId]?.nexuses || {}).length > 0 : false;
  });
  const isApplicationLabMode = useCanvasStore((state) => state.isApplicationLabMode);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '80px',
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

      {/* Center Section - Astryon Logo (Absolutely positioned for true centering) */}
      <div
        onClick={() => router.push('/chat')}
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          cursor: 'pointer',
          fontSize: '48px',
          fontWeight: 'bold',
          fontFamily: 'var(--font-orbitron)',
          background: 'linear-gradient(90deg, #00ff87, #60efff, #b967ff, #ff61d8)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '0.15em',
          filter: 'drop-shadow(0 0 20px rgba(96, 239, 255, 0.5)) drop-shadow(0 0 25px rgba(0, 255, 135, 0.4))',
          transition: 'all 0.3s ease',
          userSelect: 'none',
          animation: 'aurora-shimmer 8s ease-in-out infinite',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = 'drop-shadow(0 0 30px rgba(96, 239, 255, 0.7)) drop-shadow(0 0 35px rgba(0, 255, 135, 0.6))';
          e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = 'drop-shadow(0 0 20px rgba(96, 239, 255, 0.5)) drop-shadow(0 0 25px rgba(0, 255, 135, 0.4))';
          e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
        }}
      >
        ASTRYON
      </div>

      <style jsx>{`
        @keyframes aurora-shimmer {
          0%, 100% { filter: hue-rotate(0deg); }
          50% { filter: hue-rotate(20deg); }
        }
      `}</style>

      {/* Right Section - Application Lab & Memories Buttons */}
      <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        {/* Application Lab Button - only show when there's a universe */}
        {hasUniverse && !isApplicationLabMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log('🔬 ========== APPLICATION LAB BUTTON CLICKED ==========');
              console.log('🔬 BEFORE enable - Current mode:', isApplicationLabMode);
              enableApplicationLabMode();
              console.log('🔬 AFTER enable - Mode should now be TRUE');
            }}
            style={{
              padding: '12px 24px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '2px solid #10B981',
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
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.4)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span style={{ fontSize: '20px' }}>🔬</span>
            Application Lab
          </button>
        )}

        {/* Memories Button */}
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
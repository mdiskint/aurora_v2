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
      {/* Aurora Logo */}
      <button
        onClick={() => router.push('/chat')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #00FFD4 0%, #9333EA 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '2px',
        }}>
          Aurora
        </div>
      </button>

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
  );
}
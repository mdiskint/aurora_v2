'use client';

import { useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';

export default function Home() {
  // 🚀 BLANK CANVAS ON STARTUP - Universes load on demand from Memories
  useEffect(() => {
    console.log('🚀 [HOME] Starting with blank canvas - no auto-load');
    // loadFromLocalStorage(); // ← Removed: Canvas should start EMPTY
  }, []);

  const handleChat = () => {
    window.location.href = '/chat';
  };

  const handleCreateCourse = () => {
    window.location.href = '/course-builder';
  };

  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      backgroundColor: '#050A1E',
      backgroundImage: 'url(/aurora-bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'auto',
      padding: '40px 0'
    }}>
      {/* Animated grid background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 255, 212, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 255, 212, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        animation: 'gridMove 20s linear infinite',
        zIndex: 0
      }} />

      {/* Dark overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(5, 10, 30, 0.4) 0%, rgba(5, 10, 30, 0.9) 100%)',
        zIndex: 1
      }} />

      {/* Floating orbs */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '15%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0) 70%)',
        borderRadius: '50%',
        animation: 'float 8s ease-in-out infinite',
        filter: 'blur(40px)',
        zIndex: 1
      }} />

      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '15%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, rgba(255, 215, 0, 0) 70%)',
        borderRadius: '50%',
        animation: 'float 10s ease-in-out infinite reverse',
        filter: 'blur(60px)',
        zIndex: 1
      }} />

      {/* Central glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(0, 255, 212, 0.08) 0%, rgba(5, 10, 30, 0) 70%)',
        animation: 'pulse 4s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 1
      }} />

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(2deg); }
        }

        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }

        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hero-title {
          animation: fadeInUp 0.8s ease-out;
        }

        .hero-subtitle {
          animation: fadeInUp 1s ease-out;
        }

        .hero-buttons {
          animation: fadeInUp 1.2s ease-out;
        }

        .button-glow {
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .button-glow::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            45deg,
            transparent,
            rgba(255, 255, 255, 0.1),
            transparent
          );
          transform: rotate(45deg);
          animation: shimmer 3s infinite;
        }

        .button-glow:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 10px 40px rgba(0, 255, 212, 0.4);
        }

        .button-glow:active {
          transform: translateY(-2px) scale(1.01);
        }

        .feature-card {
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-5px);
        }
      `}</style>

      {/* Main Content */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        maxWidth: '1200px',
        padding: '0 40px'
      }}>
        {/* Logo/Title */}
        <div className="hero-title" style={{
          fontSize: '96px',
          fontWeight: '800',
          backgroundImage: 'linear-gradient(90deg, #00ff87, #60efff, #b967ff, #ff61d8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '24px',
          letterSpacing: '4px',
          textShadow: '0 0 80px rgba(96, 239, 255, 0.3)',
          lineHeight: '1.1'
        }}>
          Aurora
        </div>

        {/* Tagline */}
        <div className="hero-subtitle" style={{
          fontSize: '28px',
          color: 'rgba(255, 255, 255, 0.9)',
          marginBottom: '60px',
          fontWeight: '300',
          letterSpacing: '1px',
          maxWidth: '700px',
          margin: '0 auto 60px',
          lineHeight: '1.5'
        }}>
          Welcome to the Conversation
        </div>

        {/* CTA Buttons */}
        <div className="hero-buttons" style={{
          display: 'flex',
          gap: '40px',
          justifyContent: 'center',
          marginBottom: '80px',
          flexWrap: 'wrap'
        }}>
          <div className="feature-card" style={{
            background: 'rgba(59, 130, 246, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '20px',
            padding: '40px',
            width: '320px',
            cursor: 'pointer'
          }}
          onClick={handleChat}
          >
            <div style={{
              fontSize: '48px',
              marginBottom: '20px'
            }}>💬</div>
            <h3 style={{
              fontSize: '28px',
              color: '#3B82F6',
              marginBottom: '12px',
              fontWeight: '700'
            }}>Chat</h3>
            <p style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '16px',
              marginBottom: '24px',
              lineHeight: '1.6'
            }}>
              Engage in AI-powered conversations that expand into visual knowledge graphs
            </p>
            <button
              className="button-glow"
              style={{
                width: '100%',
                padding: '16px 32px',
                fontSize: '18px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                color: 'white',
                border: '2px solid rgba(59, 130, 246, 0.5)',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
            >
              Start Chatting
            </button>
          </div>

          <div className="feature-card" style={{
            background: 'rgba(255, 215, 0, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '20px',
            padding: '40px',
            width: '320px',
            cursor: 'pointer'
          }}
          onClick={handleCreateCourse}
          >
            <div style={{
              fontSize: '48px',
              marginBottom: '20px'
            }}>🎓</div>
            <h3 style={{
              fontSize: '28px',
              color: '#FFD700',
              marginBottom: '12px',
              fontWeight: '700'
            }}>Create Course</h3>
            <p style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '16px',
              marginBottom: '24px',
              lineHeight: '1.6'
            }}>
              Build structured learning universes with AI-generated quizzes and essays
            </p>
            <button
              className="button-glow"
              style={{
                width: '100%',
                padding: '16px 32px',
                fontSize: '18px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                color: '#050A1E',
                border: '2px solid rgba(255, 215, 0, 0.5)',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
            >
              Build Now
            </button>
          </div>
        </div>

        {/* Feature highlights */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '60px',
          flexWrap: 'wrap',
          opacity: 0.8
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '32px',
              marginBottom: '8px'
            }}>🌌</div>
            <div style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '14px',
              fontWeight: '600',
              letterSpacing: '0.5px'
            }}>3D Visualization</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '32px',
              marginBottom: '8px'
            }}>🤖</div>
            <div style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '14px',
              fontWeight: '600',
              letterSpacing: '0.5px'
            }}>AI-Powered</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '32px',
              marginBottom: '8px'
            }}>🔗</div>
            <div style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '14px',
              fontWeight: '600',
              letterSpacing: '0.5px'
            }}>Connected Learning</div>
          </div>
        </div>
      </div>
    </div>
  );
}

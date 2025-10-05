'use client';

export default function Home() {
  const handleCreate = () => {
    window.location.href = '/create';
  };

  const handleExplore = () => {
    window.location.href = '/explore';
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#050A1E',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(0, 255, 212, 0.1) 0%, rgba(5, 10, 30, 0) 70%)',
        animation: 'pulse 4s ease-in-out infinite',
        pointerEvents: 'none'
      }} />

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        .button-hover {
          transition: all 0.3s ease;
        }

        .button-hover:hover {
          transform: scale(1.05);
          box-shadow: 0 0 30px rgba(0, 255, 212, 0.5);
        }
      `}</style>

      <h1 style={{
        fontSize: '64px',
        fontWeight: 'bold',
        color: '#00FFD4',
        marginBottom: '16px',
        textAlign: 'center',
        letterSpacing: '2px',
        textShadow: '0 0 20px rgba(0, 255, 212, 0.5)',
        animation: 'float 3s ease-in-out infinite',
        zIndex: 1
      }}>
        Aurora
      </h1>

      <p style={{
        fontSize: '42px',
        color: '#FFD700',
        marginBottom: '60px',
        textAlign: 'center',
        fontWeight: '700',
        letterSpacing: '2px',
        textShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
        zIndex: 1
      }}>
        Welcome to the Conversation
      </p>

      <div style={{
        display: 'flex',
        gap: '32px',
        zIndex: 1
      }}>
        <button
          onClick={handleCreate}
          className="button-hover"
          style={{
            padding: '20px 50px',
            fontSize: '24px',
            fontWeight: 'bold',
            backgroundColor: '#9333EA',
            color: 'white',
            border: '3px solid #9333EA',
            borderRadius: '12px',
            cursor: 'pointer',
            minWidth: '200px'
          }}
        >
          Create
        </button>

        <button
          onClick={handleExplore}
          className="button-hover"
          style={{
            padding: '20px 50px',
            fontSize: '24px',
            fontWeight: 'bold',
            backgroundColor: '#00FFD4',
            color: '#050A1E',
            border: '3px solid #00FFD4',
            borderRadius: '12px',
            cursor: 'pointer',
            minWidth: '200px'
          }}
        >
          Explore
        </button>
      </div>

      <div style={{
        display: 'flex',
        gap: '32px',
        marginTop: '16px',
        zIndex: 1
      }}>
        <p style={{
          color: '#4B5563',
          fontSize: '14px',
          width: '200px',
          textAlign: 'center'
        }}>
          Build your own conversations
        </p>
        <p style={{
          color: '#4B5563',
          fontSize: '14px',
          width: '200px',
          textAlign: 'center'
        }}>
          Navigate academic papers
        </p>
      </div>
    </div>
  );
}
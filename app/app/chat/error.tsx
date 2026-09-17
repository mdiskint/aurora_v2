'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#050A1E',
      color: 'white'
    }}>
      <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>Something went wrong!</h2>
      <button
        onClick={reset}
        style={{
          padding: '12px 24px',
          backgroundColor: '#00FFD4',
          color: '#050A1E',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        Try again
      </button>
    </div>
  );
}

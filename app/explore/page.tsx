'use client';

import { useCanvasStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

export default function ExplorePage() {
  const loadAcademicPaper = useCanvasStore((state) => state.loadAcademicPaper);
  const router = useRouter();

  const handleLoadPaper = () => {
    loadAcademicPaper();
    // Wait for data to load before navigating
    setTimeout(() => {
      router.push('/create');
    }, 500);
  };

  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      backgroundColor: '#050A1E',
      padding: '40px 20px',
      color: 'white'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        <h1 style={{
          fontSize: '48px',
          color: '#00FFD4',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          Academic Paper Explorer
        </h1>

        <p style={{
          fontSize: '20px',
          color: '#FFD700',
          marginBottom: '40px',
          textAlign: 'center'
        }}>
          Navigate complex arguments in 3D space
        </p>

        <div style={{
          backgroundColor: '#1f2937',
          padding: '30px',
          borderRadius: '12px',
          border: '2px solid #00FFD4',
          marginBottom: '30px'
        }}>
          <h2 style={{
            fontSize: '24px',
            color: '#00FFD4',
            marginBottom: '20px'
          }}>
            Demo: Law Review Article
          </h2>
          
          <p style={{
            fontSize: '16px',
            lineHeight: '1.6',
            marginBottom: '20px',
            color: '#d1d5db'
          }}>
            Click below to explore "Democratic Review by Rule of Maintenance" - a law review article 
            with 16 sections visualized as an interactive 3D conversation space.
          </p>

          <button
            onClick={handleLoadPaper}
            style={{
              padding: '15px 40px',
              fontSize: '18px',
              fontWeight: 'bold',
              backgroundColor: '#00FFD4',
              color: '#050A1E',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 212, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Load Demo Paper
          </button>
        </div>

        <div style={{
          backgroundColor: '#1f2937',
          padding: '30px',
          borderRadius: '12px',
          border: '2px solid #4B5563'
        }}>
          <h2 style={{
            fontSize: '24px',
            color: '#00FFD4',
            marginBottom: '20px'
          }}>
            Formatting Your Own Paper (Coming Soon)
          </h2>

          <p style={{
            fontSize: '16px',
            lineHeight: '1.6',
            marginBottom: '15px',
            color: '#d1d5db'
          }}>
            To prepare your academic paper for Aurora, follow these guidelines:
          </p>

          <ul style={{
            fontSize: '16px',
            lineHeight: '1.8',
            marginLeft: '20px',
            color: '#d1d5db'
          }}>
            <li>Format section headings with clear hierarchy (I, II, III or 1, 2, 3)</li>
            <li>Use subsection markers (A, B, C or a, b, c)</li>
            <li>Keep full text for each section (Aurora preserves all content)</li>
            <li>Mark sections with <code style={{backgroundColor: '#374151', padding: '2px 6px', borderRadius: '4px'}}>L1.X</code> labels to indicate level</li>
            <li>Separate sections with clear delimiters (dashes or markers)</li>
          </ul>

          <p style={{
            fontSize: '14px',
            color: '#9ca3af',
            marginTop: '20px',
            fontStyle: 'italic'
          }}>
            Upload functionality and automatic parsing coming soon.
          </p>
        </div>

        <div style={{
          textAlign: 'center',
          marginTop: '40px'
        }}>
          <button
            onClick={() => router.push('/')}
            style={{
              padding: '12px 30px',
              fontSize: '16px',
              backgroundColor: 'transparent',
              color: '#00FFD4',
              border: '2px solid #00FFD4',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
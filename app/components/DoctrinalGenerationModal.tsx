'use client';

import { createPortal } from 'react-dom';

interface DoctrinalGenerationModalProps {
  isOpen: boolean;
  ruleName: string;
  stage: 'researching' | 'finding-cases' | 'analyzing' | 'building-map' | 'complete' | 'error';
  errorMessage?: string;
}

export default function DoctrinalGenerationModal({
  isOpen,
  ruleName,
  stage,
  errorMessage
}: DoctrinalGenerationModalProps) {
  if (!isOpen) return null;

  const stages = [
    { key: 'researching', label: `Researching "${ruleName}"`, icon: '🔍' },
    { key: 'finding-cases', label: 'Finding relevant cases', icon: '📚' },
    { key: 'analyzing', label: 'Analyzing case law', icon: '⚖️' },
    { key: 'building-map', label: 'Building spatial map', icon: '🗺️' }
  ];

  const getStageIndex = (key: string) => stages.findIndex(s => s.key === key);
  const currentStageIndex = getStageIndex(stage);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 10, 30, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          backgroundColor: '#1f2937',
          padding: '40px',
          borderRadius: '16px',
          width: '500px',
          maxWidth: '90vw',
          border: stage === 'error' ? '2px solid #dc2626' : '2px solid #FFD700',
        }}
      >
        {stage === 'error' ? (
          <>
            <div style={{
              fontSize: '48px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              ⚠️
            </div>
            <h2 style={{
              color: '#dc2626',
              marginBottom: '20px',
              fontSize: '24px',
              textAlign: 'center'
            }}>
              Generation Failed
            </h2>
            <div style={{
              color: '#D1D5DB',
              fontSize: '16px',
              lineHeight: '1.6',
              marginBottom: '20px'
            }}>
              {errorMessage || 'We couldn\'t generate the doctrine map. Please try again or create a manual nexus.'}
            </div>
          </>
        ) : stage === 'complete' ? (
          <>
            <div style={{
              fontSize: '48px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              ✓
            </div>
            <h2 style={{
              color: '#10b981',
              marginBottom: '20px',
              fontSize: '24px',
              textAlign: 'center'
            }}>
              Doctrine Map Created!
            </h2>
            <div style={{
              color: '#D1D5DB',
              fontSize: '16px',
              textAlign: 'center'
            }}>
              Ready to explore
            </div>
          </>
        ) : (
          <>
            <h2 style={{
              color: '#FFD700',
              marginBottom: '24px',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '32px' }}>🤖</span>
              Generating Doctrine Map
            </h2>

            <div style={{ marginBottom: '32px' }}>
              {stages.map((s, index) => {
                const isComplete = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                const isPending = index > currentStageIndex;

                return (
                  <div
                    key={s.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '16px',
                      opacity: isPending ? 0.4 : 1,
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: isComplete ? '#10b981' : isCurrent ? '#FFD700' : '#4b5563',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      flexShrink: 0,
                      transition: 'all 0.3s'
                    }}>
                      {isComplete ? '✓' : isCurrent ? (
                        <div className="spinner" style={{
                          width: '12px',
                          height: '12px',
                          border: '2px solid #050A1E',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.6s linear infinite'
                        }} />
                      ) : ''}
                    </div>

                    <span style={{
                      color: isComplete ? '#10b981' : isCurrent ? '#FFD700' : '#9CA3AF',
                      fontSize: '16px',
                      fontWeight: isCurrent ? 'bold' : 'normal',
                      transition: 'all 0.3s'
                    }}>
                      {s.icon} {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{
              textAlign: 'center',
              color: '#9CA3AF',
              fontSize: '14px',
              fontStyle: 'italic'
            }}>
              This may take 10-20 seconds...
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

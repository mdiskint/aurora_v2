
'use client';

import React from 'react';

interface GapModeModalsProps {
  showPlanningModal: boolean;
  setShowPlanningModal: (show: boolean) => void;
  planningReasoning: string;
  parallelTasks: string[];
  executeParallelTasks: () => void;
  showProgressModal: boolean;
  setShowProgressModal: (show: boolean) => void;
  progressStatus: { [key: number]: 'pending' | 'complete' | 'error' };
  setProgressStatus: (status: { [key: number]: 'pending' | 'complete' | 'error' }) => void;
}

export default function GapModeModals({
  showPlanningModal,
  setShowPlanningModal,
  planningReasoning,
  parallelTasks,
  executeParallelTasks,
  showProgressModal,
  setShowProgressModal,
  progressStatus,
  setProgressStatus,
}: GapModeModalsProps) {
  return (
    <>
      {/* GAP Mode: Planning Modal */}
      {showPlanningModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#0A1628',
            border: '3px solid #8B5CF6',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            boxShadow: '0 0 40px rgba(139, 92, 246, 0.4)'
          }}>
            <h2 style={{
              color: '#8B5CF6',
              fontSize: '24px',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              🧠 GRAPH-AWARE PARALLEL EXPLORATION
            </h2>

            <div style={{
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid #8B5CF6',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                color: '#E5E7EB',
                fontSize: '14px',
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                AI Analysis:
              </div>
              <div style={{
                color: '#D1D5DB',
                fontSize: '14px',
                lineHeight: '1.6'
              }}>
                {planningReasoning}
              </div>
            </div>

            <div style={{
              marginBottom: '20px'
            }}>
              <div style={{
                color: '#E5E7EB',
                fontSize: '14px',
                fontWeight: 'bold',
                marginBottom: '12px'
              }}>
                Independent tasks to explore:
              </div>
              {parallelTasks.map((task, index) => (
                <div key={index} style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid #10B981',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <span style={{ color: '#10B981', fontSize: '16px' }}>✓</span>
                  <span style={{ color: '#D1D5DB', fontSize: '14px', flex: 1 }}>
                    Task {index + 1}: {task}
                  </span>
                </div>
              ))}
            </div>

            <div style={{
              color: '#9CA3AF',
              fontSize: '13px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              These will be created as sibling nodes.
              <br />
              Estimated time: ~{parallelTasks.length * 7} seconds
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowPlanningModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'transparent',
                  color: '#9CA3AF',
                  border: '2px solid #4B5563',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setShowPlanningModal(false);
                  executeParallelTasks();
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#8B5CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '14px',
                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
                }}
              >
                Execute Parallel Exploration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAP Mode: Progress Modal */}
      {showProgressModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001
        }}>
          <div style={{
            backgroundColor: '#0A1628',
            border: '2px solid #8B5CF6',
            borderRadius: '16px',
            padding: '32px',
            minWidth: '400px',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '32px',
              marginBottom: '16px'
            }}>⚡</div>

            <h3 style={{
              color: '#8B5CF6',
              fontSize: '20px',
              marginBottom: '20px'
            }}>
              EXECUTING PARALLEL EXPLORATION
            </h3>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '20px'
            }}>
              {parallelTasks.map((task, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                  borderRadius: '8px'
                }}>
                  <span style={{
                    fontSize: '18px'
                  }}>
                    {progressStatus[index] === 'complete' ? '✅' : progressStatus[index] === 'error' ? '❌' : '⏳'}
                  </span>
                  <span style={{
                    color: '#E5E7EB',
                    fontSize: '14px',
                    flex: 1,
                    textAlign: 'left'
                  }}>
                    Task {index + 1}: {progressStatus[index] === 'complete' ? 'Complete' : progressStatus[index] === 'error' ? 'Error' : 'In progress...'}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setShowProgressModal(false);
                setProgressStatus({});
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: '#9CA3AF',
                border: '2px solid #4B5563',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel remaining
            </button>
          </div>
        </div>
      )}
    </>
  );
}

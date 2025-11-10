'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '@/lib/store';

interface ApplicationLabSceneProps {
  children: React.ReactNode; // The 3D canvas will be passed as children
}

export default function ApplicationLabScene({ children }: ApplicationLabSceneProps) {
  const analyzeUniverseContent = useCanvasStore((state) => state.analyzeUniverseContent);
  const isAnalyzing = useCanvasStore((state) => state.isAnalyzingUniverse);
  const analysis = useCanvasStore((state) => state.applicationLabAnalysis);
  const disableApplicationLabMode = useCanvasStore((state) => state.disableApplicationLabMode);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Essay question state
  const [essayQuestion, setEssayQuestion] = useState<string | null>(null);
  const [isGeneratingEssay, setIsGeneratingEssay] = useState(false);

  useEffect(() => {
    console.log('🔬🔬🔬 ApplicationLabScene MOUNTED TO DOM');
    setMounted(true);
    document.body.style.overflow = 'hidden';

    return () => {
      console.log('🔬🔬🔬 ApplicationLabScene UNMOUNTED FROM DOM');
      document.body.style.overflow = '';
      // Clear essay question state on unmount
      setEssayQuestion(null);
    };
  }, []);

  console.log('🔬 ApplicationLabScene rendering', {
    hasChildren: !!children,
    isAnalyzing,
    hasAnalysis: !!analysis,
    mounted
  });

  if (!mounted) return null;

  const handleAnalyze = async () => {
    setError(null);
    try {
      console.log('🔬 Starting analysis from ApplicationLabScene...');
      await analyzeUniverseContent();
      console.log('🔬 Analysis completed successfully!');
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to analyze universe content. Please try again.';
      setError(errorMessage);
      console.error('🔬 Analysis error in ApplicationLabScene:', err);
      console.error('🔬 Error details:', {
        message: err?.message,
        stack: err?.stack,
        full: err
      });
    }
  };

  const handleExit = () => {
    console.log('🔬 Exiting Application Lab');
    disableApplicationLabMode();
  };

  const handleGenerateEssay = async () => {
    if (!analysis) return;

    setIsGeneratingEssay(true);
    setEssayQuestion(null);

    try {
      const analysisContext = `
TOPICS:
${analysis.topics.map(t => `- ${t.name}: ${t.description}`).join('\n')}

CASES:
${analysis.cases.map(c => `- ${c.name}: ${c.summary}`).join('\n')}

DOCTRINES:
${analysis.doctrines.map(d => `- ${d.name}: ${d.explanation}`).join('\n')}
`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: analysisContext }],
          mode: 'essay-question'
        }),
      });

      if (!response.ok) throw new Error('Failed to generate essay question');

      const data = await response.json();
      setEssayQuestion(data.response);

    } catch (err) {
      console.error('Failed to generate essay question:', err);
      setEssayQuestion('❌ Failed to generate essay question. Please try again.');
    } finally {
      setIsGeneratingEssay(false);
    }
  };

  const handleDownload = () => {
    if (!analysis) return;

    // Create formatted HTML document that Word can open
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Application Lab Analysis Results</title>
    <style>
        body {
            font-family: 'Calibri', 'Arial', sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 {
            color: #2563EB;
            border-bottom: 3px solid #2563EB;
            padding-bottom: 10px;
        }
        h2 {
            color: #059669;
            margin-top: 30px;
            border-left: 4px solid #059669;
            padding-left: 12px;
        }
        .metadata {
            background-color: #F3F4F6;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .item {
            background-color: #F9FAFB;
            border-left: 4px solid #3B82F6;
            padding: 15px;
            margin-bottom: 15px;
            page-break-inside: avoid;
        }
        .item-title {
            font-weight: bold;
            color: #1E40AF;
            font-size: 1.1em;
            margin-bottom: 8px;
        }
        .item-content {
            color: #4B5563;
        }
        .topic { border-left-color: #06B6D4; }
        .topic .item-title { color: #0891B2; }
        .case { border-left-color: #A78BFA; }
        .case .item-title { color: #7C3AED; }
        .doctrine { border-left-color: #F59E0B; }
        .doctrine .item-title { color: #D97706; }
        .count {
            display: inline-block;
            background-color: #E5E7EB;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.9em;
            margin-left: 8px;
        }
    </style>
</head>
<body>
    <h1>🔬 Application Lab Analysis Results</h1>

    <div class="metadata">
        <strong>Analysis Date:</strong> ${new Date(analysis.analyzedAt || Date.now()).toLocaleString()}<br>
        <strong>Total Items:</strong> ${analysis.topics.length + analysis.cases.length + analysis.doctrines.length}
    </div>

    <h2>📚 Topics <span class="count">${analysis.topics.length}</span></h2>
    ${analysis.topics.length > 0 ? analysis.topics.map(topic => `
    <div class="item topic">
        <div class="item-title">${topic.name}</div>
        <div class="item-content">${topic.description}</div>
    </div>
    `).join('') : '<p><em>No topics found</em></p>'}

    <h2>⚖️ Cases <span class="count">${analysis.cases.length}</span></h2>
    ${analysis.cases.length > 0 ? analysis.cases.map(case_ => `
    <div class="item case">
        <div class="item-title">${case_.name}</div>
        <div class="item-content">${case_.summary}</div>
    </div>
    `).join('') : '<p><em>No cases found</em></p>'}

    <h2>📖 Doctrines <span class="count">${analysis.doctrines.length}</span></h2>
    ${analysis.doctrines.length > 0 ? analysis.doctrines.map(doctrine => `
    <div class="item doctrine">
        <div class="item-title">${doctrine.name}</div>
        <div class="item-content">${doctrine.explanation}</div>
    </div>
    `).join('') : '<p><em>No doctrines found</em></p>'}

</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `application-lab-analysis-${Date.now()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('🔬 Downloaded analysis results as Word document');
  };

  const overlayContent = (
    <div
      id="application-lab-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999999,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        flexDirection: 'row',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}>
      {/* Left 60%: 3D Universe */}
      <div style={{
        width: '60%',
        height: '100vh',
        minHeight: '100vh',
        position: 'relative',
        backgroundColor: '#000000',
        borderRight: '1px solid rgba(6, 182, 212, 0.3)',
        flexShrink: 0,
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 10
        }}>
          <h3 style={{
            color: '#06B6D4',
            fontSize: '18px',
            fontWeight: '600',
            margin: 0
          }}>
            🗺️ Universe Map
          </h3>
        </div>
        <div style={{ width: '100%', height: '100%' }}>
          {children}
        </div>
      </div>

      {/* Right 40%: Workspace */}
      <div style={{
        width: '40%',
        height: '100vh',
        minHeight: '100vh',
        backgroundColor: '#111827',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid rgba(6, 182, 212, 0.3)',
          backgroundColor: '#0F1623',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div>
            <h2 style={{
              fontSize: '28px',
              fontWeight: 'bold',
              background: 'linear-gradient(to right, #06B6D4, #A78BFA)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              margin: 0,
              marginBottom: '8px'
            }}>
              🔬 Application Lab
            </h2>
            <p style={{
              color: '#9CA3AF',
              fontSize: '14px',
              margin: 0
            }}>
              Practice applying concepts to new scenarios
            </p>
          </div>
          <button
            onClick={handleExit}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              color: '#F87171',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            }}
          >
            ✕ Exit Lab
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto'
        }}>
          {!analysis ? (
            // No analysis yet - show analyze prompt
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%'
            }}>
              <div style={{
                maxWidth: '400px',
                padding: '40px',
                borderRadius: '12px',
                backgroundColor: '#1F2937',
                border: '2px dashed #374151',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '48px',
                  marginBottom: '20px'
                }}>
                  {isAnalyzing ? '⏳' : error ? '⚠️' : '🧠'}
                </div>
                <h3 style={{
                  color: '#9CA3AF',
                  fontSize: '20px',
                  fontWeight: 'normal',
                  marginBottom: '16px'
                }}>
                  {isAnalyzing ? 'Analyzing Universe...' : error ? 'Analysis Failed' : 'Analyze Your Universe'}
                </h3>
                <p style={{
                  color: error ? '#EF4444' : '#6B7280',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  marginBottom: '24px'
                }}>
                  {error || 'Analyze your universe to extract topics, cases, and doctrines. This creates the foundation for personalized practice scenarios.'}
                </p>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: isAnalyzing ? '#6B7280' : '#10B981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: isAnalyzing ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isAnalyzing) {
                      e.currentTarget.style.backgroundColor = '#059669';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isAnalyzing) {
                      e.currentTarget.style.backgroundColor = '#10B981';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                >
                  {isAnalyzing ? '⏳ Analyzing...' : error ? '🔄 Retry Analysis' : '🔬 Analyze Universe'}
                </button>
              </div>
            </div>
          ) : (
            // Analysis complete - show results
            <div>
              <div style={{
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{
                    color: '#10B981',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    margin: 0,
                    marginBottom: '4px'
                  }}>
                    ✓ Analysis Complete
                  </h3>
                  <p style={{
                    color: '#6B7280',
                    fontSize: '12px',
                    margin: 0
                  }}>
                    {new Date(analysis.analyzedAt || Date.now()).toLocaleString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleDownload}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      color: '#10B981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                    }}
                  >
                    💾 Download
                  </button>
                  <button
                    onClick={handleAnalyze}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      color: '#60A5FA',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                    }}
                  >
                    🔄 Re-analyze
                  </button>
                </div>
              </div>

              {/* Topics Section */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{
                  color: '#06B6D4',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginBottom: '12px'
                }}>
                  📚 Topics ({analysis.topics.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analysis.topics.map((topic) => (
                    <div
                      key={topic.id}
                      style={{
                        padding: '12px',
                        backgroundColor: '#1F2937',
                        borderRadius: '8px',
                        border: '1px solid rgba(6, 182, 212, 0.3)'
                      }}
                    >
                      <div style={{
                        color: '#06B6D4',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '4px'
                      }}>
                        {topic.name}
                      </div>
                      <div style={{
                        color: '#9CA3AF',
                        fontSize: '12px',
                        lineHeight: '1.5'
                      }}>
                        {topic.description}
                      </div>
                    </div>
                  ))}
                  {analysis.topics.length === 0 && (
                    <div style={{ color: '#6B7280', fontSize: '14px', fontStyle: 'italic' }}>
                      No topics found
                    </div>
                  )}
                </div>
              </div>

              {/* Cases Section */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{
                  color: '#A78BFA',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginBottom: '12px'
                }}>
                  ⚖️ Cases ({analysis.cases.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analysis.cases.map((case_) => (
                    <div
                      key={case_.id}
                      style={{
                        padding: '12px',
                        backgroundColor: '#1F2937',
                        borderRadius: '8px',
                        border: '1px solid rgba(167, 139, 250, 0.3)'
                      }}
                    >
                      <div style={{
                        color: '#A78BFA',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '4px'
                      }}>
                        {case_.name}
                      </div>
                      <div style={{
                        color: '#9CA3AF',
                        fontSize: '12px',
                        lineHeight: '1.5'
                      }}>
                        {case_.summary}
                      </div>
                    </div>
                  ))}
                  {analysis.cases.length === 0 && (
                    <div style={{ color: '#6B7280', fontSize: '14px', fontStyle: 'italic' }}>
                      No cases found
                    </div>
                  )}
                </div>
              </div>

              {/* Doctrines Section */}
              <div style={{ marginBottom: '32px' }}>
                <h4 style={{
                  color: '#F59E0B',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginBottom: '12px'
                }}>
                  📖 Doctrines ({analysis.doctrines.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analysis.doctrines.map((doctrine) => (
                    <div
                      key={doctrine.id}
                      style={{
                        padding: '12px',
                        backgroundColor: '#1F2937',
                        borderRadius: '8px',
                        border: '1px solid rgba(245, 158, 11, 0.3)'
                      }}
                    >
                      <div style={{
                        color: '#F59E0B',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '4px'
                      }}>
                        {doctrine.name}
                      </div>
                      <div style={{
                        color: '#9CA3AF',
                        fontSize: '12px',
                        lineHeight: '1.5'
                      }}>
                        {doctrine.explanation}
                      </div>
                    </div>
                  ))}
                  {analysis.doctrines.length === 0 && (
                    <div style={{ color: '#6B7280', fontSize: '14px', fontStyle: 'italic' }}>
                      No doctrines found
                    </div>
                  )}
                </div>
              </div>

              {/* Practice Application Section */}
              <div style={{
                borderTop: '2px solid rgba(139, 92, 246, 0.3)',
                paddingTop: '24px',
                marginTop: '32px'
              }}>
                <h3 style={{
                  color: '#8B5CF6',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  marginBottom: '12px'
                }}>
                  🎯 Practice Application
                </h3>
                <p style={{
                  color: '#9CA3AF',
                  fontSize: '14px',
                  marginBottom: '20px',
                  lineHeight: '1.6'
                }}>
                  Apply the doctrines and principles you've learned to new scenarios
                </p>

                {/* Essay Question Section */}
                <div style={{ marginBottom: '32px' }}>
                  <h4 style={{
                    color: '#10B981',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    marginBottom: '12px'
                  }}>
                    📝 Essay Question
                  </h4>
                  {!essayQuestion ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <button
                        onClick={handleGenerateEssay}
                        disabled={isGeneratingEssay}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: isGeneratingEssay ? '#6B7280' : '#10B981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          cursor: isGeneratingEssay ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          opacity: isGeneratingEssay ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!isGeneratingEssay) {
                            e.currentTarget.style.backgroundColor = '#059669';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isGeneratingEssay) {
                            e.currentTarget.style.backgroundColor = '#10B981';
                            e.currentTarget.style.transform = 'scale(1)';
                          }
                        }}
                      >
                        {isGeneratingEssay ? '⏳ Generating Essay...' : '📝 Generate Essay Question'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{
                        backgroundColor: '#1F2937',
                        padding: '20px',
                        borderRadius: '12px',
                        border: '2px solid rgba(16, 185, 129, 0.3)',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          color: '#E5E7EB',
                          fontSize: '14px',
                          lineHeight: '1.8',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {essayQuestion}
                        </div>
                      </div>
                      <button
                        onClick={() => setEssayQuestion(null)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'rgba(107, 114, 128, 0.2)',
                          color: '#9CA3AF',
                          border: '1px solid #4B5563',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(107, 114, 128, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(107, 114, 128, 0.2)';
                        }}
                      >
                        ↻ Generate New Question
                      </button>
                    </div>
                  )}
                </div>
            </div>
          </div>
          )
        }
        </div>
      </div>
    </div>
  );

  return createPortal(overlayContent, document.body);
}

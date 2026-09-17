'use client';

import { useState } from 'react';
import { ApplicationEssay } from '@/lib/types';

interface ApplicationEssaySectionProps {
  applicationEssay: ApplicationEssay;
  onClose?: () => void;
}

export default function ApplicationEssaySection({ applicationEssay, onClose }: ApplicationEssaySectionProps) {
  const [essayAnswer, setEssayAnswer] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!essayAnswer.trim()) {
      alert('Please write your answer before submitting.');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Essay Question:\n${applicationEssay.question}\n\nGrading Rubric:\n${applicationEssay.rubric}\n\nStudent's Answer:\n${essayAnswer}`
          }],
          mode: 'grade-application-essay'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to grade essay');
      }

      const data = await response.json();
      setFeedback(data.response);
    } catch (error) {
      console.error('Error grading essay:', error);
      setFeedback('❌ Failed to grade your essay. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-purple-500/50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-purple-500/30 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
          <h2 className="text-2xl font-bold text-purple-300">📝 Application Essay</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded"
              type="button"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Essay Question */}
          <div className="bg-slate-950/50 border border-purple-500/30 rounded-lg p-6">
            <h3 className="text-lg font-bold text-purple-300 mb-4">Question</h3>
            <div className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
              {applicationEssay.question}
            </div>
          </div>

          {/* Answer Input */}
          <div className="bg-slate-950/50 border border-purple-500/30 rounded-lg p-6">
            <h3 className="text-lg font-bold text-purple-300 mb-4">Your Answer</h3>
            <textarea
              value={essayAnswer}
              onChange={(e) => setEssayAnswer(e.target.value)}
              placeholder="Write your essay answer here... Apply the doctrines and principles you've learned to analyze this scenario."
              className="w-full h-96 bg-slate-900 border border-purple-500/20 rounded-lg p-4 text-gray-200 text-base leading-relaxed focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 resize-none"
              disabled={isSubmitting}
            />
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-400">
                {essayAnswer.length} characters
              </div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !essayAnswer.trim()}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-gray-500 text-white rounded-lg transition-all font-bold disabled:cursor-not-allowed"
              >
                {isSubmitting ? '⏳ Grading...' : '✓ Submit for Grading'}
              </button>
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <div className="bg-slate-950/50 border-2 border-green-500/50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-green-300 mb-4 flex items-center gap-2">
                <span>📊</span>
                <span>Grading Feedback</span>
              </h3>
              <div className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
                {feedback}
              </div>
              <div className="mt-6 pt-4 border-t border-green-500/20">
                <button
                  onClick={() => {
                    setEssayAnswer('');
                    setFeedback(null);
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition-all text-sm"
                >
                  🔄 Try Again
                </button>
              </div>
            </div>
          )}

          {/* Rubric (Collapsible) */}
          <details className="bg-slate-950/30 border border-purple-500/20 rounded-lg">
            <summary className="p-4 cursor-pointer text-purple-300 font-semibold hover:bg-purple-900/10 transition-colors rounded-lg">
              📋 View Grading Rubric
            </summary>
            <div className="p-6 pt-2 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap border-t border-purple-500/10">
              {applicationEssay.rubric}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

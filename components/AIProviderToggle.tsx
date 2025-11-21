'use client'

import { useCanvasStore } from '@/lib/store'

export default function AIProviderToggle() {
    const aiProvider = useCanvasStore((state) => state.aiProvider)
    const setAiProvider = useCanvasStore((state) => state.setAiProvider)

    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#0A1628] rounded-lg border border-[#00FFD4]/20">
            <span className="text-sm text-gray-400">AI:</span>
            <button
                onClick={() => setAiProvider('anthropic')}
                className={`px-3 py-1 rounded text-sm transition-colors ${aiProvider === 'anthropic'
                        ? 'bg-[#00FFD4] text-[#050A1E] font-semibold'
                        : 'text-gray-400 hover:text-white'
                    }`}
            >
                Claude
            </button>
            <button
                onClick={() => setAiProvider('gemini')}
                className={`px-3 py-1 rounded text-sm transition-colors ${aiProvider === 'gemini'
                        ? 'bg-[#00FFD4] text-[#050A1E] font-semibold'
                        : 'text-gray-400 hover:text-white'
                    }`}
            >
                Gemini
            </button>
        </div>
    )
}

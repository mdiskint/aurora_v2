'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardForm({ defaultName }: { defaultName: string }) {
  const router = useRouter()
  const [form, setForm] = useState({ name: defaultName, school: '', useCase: '', role: 'learner' })
  const [loading, setLoading] = useState(false)

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/user/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-gray-800 p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Welcome to Astryon</h1>
        <p className="text-gray-400 mb-8 text-sm">Tell us a bit about yourself.</p>
        <form onSubmit={submit} className="space-y-4">
          <input
            required
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="Your name"
            className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-gray-600 focus:outline-none"
          />
          <input
            value={form.school}
            onChange={e => update('school', e.target.value)}
            placeholder="School or institution (optional)"
            className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-gray-600 focus:outline-none"
          />
          <textarea
            value={form.useCase}
            onChange={e => update('useCase', e.target.value)}
            placeholder="What will you use Astryon for? (optional)"
            rows={3}
            className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-gray-600 focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            {(['learner', 'educator'] as const).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => update('role', r)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.role === r
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0a0a0a] border border-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {loading ? 'Setting up…' : 'Get started'}
          </button>
        </form>
      </div>
    </div>
  )
}

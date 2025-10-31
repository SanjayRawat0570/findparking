"use client"

import React, { useState } from "react"

export default function AIPage() {
  const [role, setRole] = useState<'user'|'admin'>('user')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [imageResult, setImageResult] = useState<any>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)

  async function onSuggest() {
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_AI_AGENT_URL || 'http://localhost:8081'}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 12.97, lng: 77.59, query, limit: 5 })
      })
      const data = await res.json()
      setResults(data.results || data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function onChat() {
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_AI_AGENT_URL || 'http://localhost:8081'}/nl_suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 12.97, lng: 77.59, query, limit: 5 })
      })
      const data = await res.json()
      setResults(data.results || data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function onAnalyzeImage() {
    if (!imageFile) {
      alert('Choose an image first')
      return
    }
    setLoading(true)
    try {
      const form = new FormData()
      form.append('file', imageFile)
      const res = await fetch(`${process.env.NEXT_PUBLIC_AI_AGENT_URL || 'http://localhost:8081'}/image_analyze`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const txt = await res.text()
        alert('Image analyze failed: ' + txt)
        return
      }
      const data = await res.json()
      setImageResult(data)
    } catch (e) {
      console.error(e)
      alert('Image analyze error')
    } finally {
      setLoading(false)
    }
  }

  async function onPredictPrice() {
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_AI_AGENT_URL || 'http://localhost:8081'}/admin/dynamic_pricing`, {
        method: 'GET'
      })
      const data = await res.json()
      alert('Price suggestions: ' + JSON.stringify(data))
    } catch (e) {
      console.error(e)
      alert('Price prediction failed')
    } finally {
      setLoading(false)
    }
  }

  async function onAutoBook(slotId?: string) {
    setLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch(`${process.env.NEXT_PUBLIC_AI_AGENT_URL || 'http://localhost:8081'}/auto_book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ lat: 12.97, lng: 77.59, query, limit: 5 })
      })
      if (!res.ok) {
        const txt = await res.text()
        console.error('Auto-book failed', res.status, txt)
        alert('Booking failed: ' + txt)
        return
      }
      const data = await res.json()
      alert('Booked: ' + (data.booking_id || JSON.stringify(data)))
    } catch (e) {
      console.error(e)
      alert('Booking failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">AI Agent</h1>
      <div className="mb-4">
        <label className="mr-2">Mode:</label>
        <select value={role} onChange={e => setRole(e.target.value as any)}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="mb-4">
        <input className="border p-2 w-full" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ask: e.g. cheapest near me" />
      </div>
      <div className="flex gap-2 mb-4">
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={onSuggest} disabled={loading}>Suggest</button>
        <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={onChat} disabled={loading}>Chat & Rank</button>
        <button className="bg-purple-600 text-white px-4 py-2 rounded" onClick={onPredictPrice} disabled={loading}>Predict Price</button>
      </div>

      <div className="mb-4">
        <label className="block mb-2">Upload parking image for analysis</label>
        <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files ? e.target.files[0] : null)} />
        <div className="mt-2">
          <button className="bg-indigo-600 text-white px-4 py-2 rounded" onClick={onAnalyzeImage} disabled={loading}>Analyze Image</button>
        </div>
        {imageResult && (
          <div className="mt-3 p-3 border rounded">
            <div>File: {imageResult.filename} ({imageResult.size_kb} KB)</div>
            <div>Detected free slots: {imageResult.detected_free_slots}</div>
            <div className="text-xs italic">{imageResult.note}</div>
          </div>
        )}
      </div>

      <div>
        {loading && <div>Loading...</div>}
        {!loading && results && results.length === 0 && <div>No results</div>}
        <ul className="space-y-2">
          {results.map((r: any) => (
            <li key={r.id} className="p-3 border rounded">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold">{r.name || r.id}</div>
                  <div className="text-sm">Price: {r.price} | Available: {r.available}</div>
                  <div className="text-xs">{r.address}</div>
                  {r.explain && <div className="mt-2 text-sm italic text-gray-600">{r.explain}</div>}
                </div>
                <div className="flex flex-col gap-2">
                  <button className="bg-indigo-600 text-white px-3 py-1 rounded" onClick={() => onAutoBook(r.id)}>Auto-book</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

"use client"

import React, { useState } from "react"

export default function AIPage() {
  const [role, setRole] = useState<'user'|'admin'>('user')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

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
      </div>

      <div>
        {loading && <div>Loading...</div>}
        {!loading && results && results.length === 0 && <div>No results</div>}
        <ul className="space-y-2">
          {results.map((r: any) => (
            <li key={r.id} className="p-3 border rounded">
              <div className="font-semibold">{r.name || r.id}</div>
              <div className="text-sm">Price: {r.price} | Available: {r.available}</div>
              <div className="text-xs">{r.address}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

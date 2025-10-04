"use client"

export type UserRole = "admin" | "user"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
}

export interface AuthState {
  user: User | null
  token: string | null
}

// Prefer NEXT_PUBLIC_API_BASE so the client calls the backend (e.g. http://localhost:8080)
const API_BASE = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE)
  || (typeof window !== "undefined" && window.location.origin === 'http://localhost:3000' ? 'http://localhost:8080' : window.location.origin)
  || "http://localhost:8080"

async function parseJson(res: Response) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { raw: text }
  }
}

export const authService = {
  login: async (email: string, password: string): Promise<AuthState> => {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const body = await parseJson(res)
      console.error('login error', res.status, body)
      throw new Error(body.error || `login failed (${res.status})`)
    }
    const body = await res.json()
    const token = body.token as string

    // persist token
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token)
    }

    // fetch current user via /api/me
    const meRes = await fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
    if (!meRes.ok) throw new Error("failed to fetch user")
    const meBody = await meRes.json()
    const user: User = meBody.user

    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(user))
    }

    return { user, token }
  },

  signup: async (name: string, email: string, password: string, role: UserRole): Promise<AuthState> => {
    const res = await fetch(`${API_BASE}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    })
    if (!res.ok) {
      const body = await parseJson(res)
      console.error('signup error', res.status, body)
      throw new Error(body.error || `signup failed (${res.status})`)
    }
    const body = await res.json()
    const token = body.token as string

    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token)
    }

    // fetch user
    const meRes = await fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
    if (!meRes.ok) throw new Error("failed to fetch user")
    const meBody = await meRes.json()
    const user: User = meBody.user

    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(user))
    }

    return { user, token }
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token")
      localStorage.removeItem("user")
    }
  },

  getCurrentUser: (): User | null => {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user")
      return userStr ? JSON.parse(userStr) : null
    }
    return null
  },

  getToken: (): string | null => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auth_token")
    }
    return null
  },
}

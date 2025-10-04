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

// Mock authentication - replace with real API calls
export const authService = {
  login: async (email: string, password: string): Promise<AuthState> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock user data - admin@parking.com / user@parking.com
    const isAdmin = email === "admin@parking.com"
    const user: User = {
      id: isAdmin ? "admin-1" : "user-1",
      email,
      name: isAdmin ? "Admin User" : "Regular User",
      role: isAdmin ? "admin" : "user",
    }

    const token = `mock-jwt-token-${Date.now()}`

    // Store in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token)
      localStorage.setItem("user", JSON.stringify(user))
    }

    return { user, token }
  },

  signup: async (name: string, email: string, password: string, role: UserRole): Promise<AuthState> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const user: User = {
      id: `${role}-${Date.now()}`,
      email,
      name,
      role,
    }

    const token = `mock-jwt-token-${Date.now()}`

    // Store in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token)
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

"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authService, type UserRole } from "@/lib/auth"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    let mounted = true
    const verify = async () => {
      try {
        const localUser = authService.getCurrentUser()
        const token = authService.getToken()
        if (!token) {
          console.log("ProtectedRoute: no token, redirecting to login")
          router.push("/auth/login")
          return
        }

        // call backend to validate token and fetch latest user
        const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
        const res = await fetch(`${API_BASE}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!mounted) return

        if (!res.ok) {
          console.warn("ProtectedRoute: /api/me returned", res.status)
          // token invalid or server error -> go to login
          router.push("/auth/login")
          return
        }

        const body = await res.json()
        const user = body?.user ?? localUser

        // if role is missing, assume 'user' (you can change this as needed)
        const role: UserRole = (user?.role as UserRole) ?? "user"

        if (!allowedRoles.includes(role)) {
          if (role === "admin") router.push("/admin/dashboard")
          else router.push("/user/dashboard")
          return
        }

        // store user returned by backend for consistency
        if (user && typeof window !== "undefined") {
          localStorage.setItem("user", JSON.stringify(user))
        }

        setIsAuthorized(true)
      } catch (err) {
        console.error("ProtectedRoute verify error:", err)
        // safety: redirect to login after brief delay
        setTimeout(() => router.push("/auth/login"), 400)
      }
    }

    verify()

    // timeout fallback so spinner doesn't hang forever
    const t = setTimeout(() => {
      if (!mounted && !isAuthorized) return
      if (!isAuthorized) {
        console.warn("ProtectedRoute: verification timeout, redirecting to login")
        router.push("/auth/login")
      }
    }, 8000)

    return () => {
      mounted = false
      clearTimeout(t)
    }
  }, [router, allowedRoles])

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

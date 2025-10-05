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

        // If there's no token but a cached user exists locally, allow access
        // (disable automatic logout). Only redirect when the user truly has no
        // client-side credentials at all.
        if (!token) {
          if (localUser) {
            console.info("ProtectedRoute: no token but local user present; allowing access (auto-logout disabled)")
            setIsAuthorized(true)
            return
          }
          console.log("ProtectedRoute: no token and no local user, redirecting to login")
          router.push("/auth/login")
          return
        }

        // call backend to validate token and fetch latest user
        const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
        const res = await fetch(`${API_BASE}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!mounted) return

        // only force logout when the server explicitly rejects the token
        if (!res.ok) {
          console.warn("ProtectedRoute: /api/me returned", res.status)

          // If local cached user exists, prefer keeping them signed in locally
          // to avoid auto-logout. We'll still attempt a background refresh, but
          // we won't force a redirect to the login page.
          if (localUser) {
            console.info("ProtectedRoute: /api/me failed but local user exists; keeping local session (auto-logout disabled)")
            setIsAuthorized(true)
            // background re-check
            setTimeout(async () => {
              try {
                const retry = await fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
                if (retry.ok) {
                  const body = await retry.json()
                  const freshUser = body?.user
                  if (freshUser && typeof window !== "undefined") {
                    localStorage.setItem("user", JSON.stringify(freshUser))
                  }
                }
              } catch (e) {
                console.debug("ProtectedRoute background retry failed", e)
              }
            }, 5000)
            return
          }

          // No local user and /api/me failed -> redirect to login
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
        // Do not auto-logout on network or unexpected errors; if a local cached
        // user exists, allow access. Otherwise redirect to login.
        const localUserOnError = authService.getCurrentUser()
        if (localUserOnError) {
          console.info("ProtectedRoute: network/error during verify but local user exists; allowing access")
          setIsAuthorized(true)
          return
        }
        router.push("/auth/login")
      }
    }

    verify()

    // timeout fallback so spinner doesn't hang forever — but DO NOT auto-logout.
    // If verification hangs and we have a local user, allow access; otherwise
    // redirect to login after the timeout.
    const t = setTimeout(() => {
      if (!mounted && !isAuthorized) return
      if (!isAuthorized) {
        const cached = authService.getCurrentUser()
        if (cached) {
          console.info("ProtectedRoute: verification timeout, but local user exists; allowing access")
          setIsAuthorized(true)
        } else {
          console.warn("ProtectedRoute: verification timeout and no local user; redirecting to login")
          router.push("/auth/login")
        }
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

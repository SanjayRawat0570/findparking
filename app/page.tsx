"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/auth"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const user = authService.getCurrentUser()
    const token = authService.getToken()

    if (user && token) {
      // Redirect based on role
      if (user.role === "admin") {
        router.push("/admin/dashboard")
      } else {
        router.push("/user/dashboard")
      }
    } else {
      // Redirect to login
      router.push("/auth/login")
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

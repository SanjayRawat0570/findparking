"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { UserDashboard } from "@/components/user/user-dashboard"

export default function UserDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["user"]}>
      <UserDashboard />
    </ProtectedRoute>
  )
}

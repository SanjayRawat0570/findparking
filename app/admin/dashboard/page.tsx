"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminDashboard } from "@/components/admin/admin-dashboard"

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminDashboard />
    </ProtectedRoute>
  )
}

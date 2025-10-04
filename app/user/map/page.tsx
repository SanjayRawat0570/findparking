"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { MapView } from "@/components/user/map-view"

export default function MapPage() {
  return (
    <ProtectedRoute allowedRoles={["user"]}>
      <MapView />
    </ProtectedRoute>
  )
}

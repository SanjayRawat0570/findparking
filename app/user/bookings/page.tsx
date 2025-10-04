"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { UserBookings } from "@/components/user/user-bookings"

export default function UserBookingsPage() {
  return (
    <ProtectedRoute allowedRoles={["user"]}>
      <UserBookings />
    </ProtectedRoute>
  )
}

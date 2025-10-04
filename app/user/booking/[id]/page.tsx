"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { BookingFlow } from "@/components/user/booking-flow"

export default function BookingPage({ params }: { params: { id: string } }) {
  return (
    <ProtectedRoute allowedRoles={["user"]}>
      <BookingFlow spotId={params.id} />
    </ProtectedRoute>
  )
}

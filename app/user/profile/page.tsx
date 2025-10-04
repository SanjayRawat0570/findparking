"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { UserProfile } from "@/components/user/user-profile"

export default function UserProfilePage() {
  return (
    <ProtectedRoute allowedRoles={["user"]}>
      <UserProfile />
    </ProtectedRoute>
  )
}

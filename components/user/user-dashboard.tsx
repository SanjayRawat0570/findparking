"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { authService } from "@/lib/auth"
import { Search, MapPin, Clock, DollarSign, Navigation, LogOut, User, Calendar, Map } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// NOTE: This dashboard intentionally displays only slots returned by the
// backend (admin-created). Local/default/mock slots are stored in
// `frontend/lib/parking-slots.ts` for admin/local testing, but the user
// dashboard will not show them — it fetches backend data and filters out
// any items without a backend id/_id.

export function UserDashboard() {
  const router = useRouter()
  const user = authService.getCurrentUser()
  // `slots` will hold parking spots returned by the backend only.
  // Users see all admin-created slots; search and client-side filtering
  // are intentionally removed for a simpler UX.
  const [slots, setSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true)
      setError(null)
      try {
        const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
  const res = await fetch(`${API_BASE}/api/slots`)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        // normalize backend slot shape to UI shape
        // and only include slots that came from the backend (have an id/_id).
        const normalized = (data || [])
          .filter((s: any) => Boolean(s._id || s.id))
          .map((s: any) => ({
            id: s.id || s._id,
            name: s.name,
            address: s.address,
            distance: s.distance || "",
            price: s.price ?? 0,
            priceUnit: "hour",
            available: s.available ?? s.total ?? 0,
            total: s.total ?? 0,
            rating: s.rating ?? 4.0,
          }))
        setSlots(normalized)
      } catch (err: any) {
        console.warn("Failed to fetch slots, using mock", err)
        setError(err?.message || String(err))
        // Keep `slots` empty and show a friendly empty/error state to the user.
        setSlots([])
      } finally {
        setLoading(false)
      }
    }
    fetchSlots()
  }, [])


  const handleLogout = () => {
    console.log("[v0] Logout clicked")
    authService.logout()
    router.push("/auth/login")
  }

  const getAvailabilityColor = (available: number, total: number) => {
    const percentage = (available / total) * 100
    if (percentage > 50) return "text-green-600"
    if (percentage > 20) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <MapPin className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">Find Parking</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleLogout} className="hidden sm:flex bg-transparent">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full hover:bg-accent"
                  onClick={() => console.log("[v0] Profile dropdown clicked")}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/user/map")}>
                  <Map className="mr-2 h-4 w-4" />
                  Map View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/user/bookings")}>
                  <Calendar className="mr-2 h-4 w-4" />
                  My Bookings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/user/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-8">
        {/* Search Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-balance">Find Your Perfect Parking Spot</h1>
          <p className="text-muted-foreground mb-6">Search for available parking near you</p>

          <div className="flex gap-2 max-w-2xl">
            <Button size="lg" variant="outline" onClick={() => router.push("/user/map")}> 
              <Map className="mr-2 h-5 w-5" />
              Map View
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Spots</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">151</div>
              <p className="text-xs text-muted-foreground">Across 4 locations</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2</div>
              <p className="text-xs text-muted-foreground">Current reservations</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Price</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$7.75</div>
              <p className="text-xs text-muted-foreground">Per hour nearby</p>
            </CardContent>
          </Card>
        </div>

        {/* Parking Spots List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Nearby Parking Spots</h2>
          {loading ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p>Loading nearby parking...</p>
              </CardContent>
            </Card>
          ) : slots.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-1">No parking spots found</p>
                <p className="text-sm text-muted-foreground">Try adjusting your search</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {slots.map((spot: any) => (
                <Card key={spot.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{spot.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {spot.address}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {spot.distance}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            <span className="font-semibold text-lg">${spot.price}</span>
                            <span className="text-muted-foreground">/{spot.priceUnit}</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${getAvailabilityColor(spot.available, spot.total)}`}>
                          {spot.available} available
                        </p>
                        <p className="text-xs text-muted-foreground">of {spot.total} spots</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => router.push(`/user/booking/${spot.id}`)}>
                        Book Now
                      </Button>
                      <Button variant="outline" size="icon">
                        <Navigation className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

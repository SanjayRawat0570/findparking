"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MapPin, Navigation, Clock } from "lucide-react"
import React, { Suspense, lazy } from "react"
import { type ParkingSlot } from "@/lib/parking-slots"

const DynamicMap = lazy(() => import("./enhanced-leaflet-map"))

export function MapView() {
  const router = useRouter()
  const [parkingSpots, setParkingSpots] = useState<ParkingSlot[]>([])
  const [selectedSpot, setSelectedSpot] = useState<string | null>(null)
  const [userLocation] = useState({ lat: 40.758, lng: -73.9855 }) // Mock user location (Times Square)
  const [activeBookings] = useState(["1", "3"])

  useEffect(() => {
    // Fetch initial slots from backend
    const fetchSlots = async () => {
      try {
        const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
  const res = await fetch(`${API_BASE}/api/slots/`)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        const normalized: ParkingSlot[] = (data || [])
          .filter((s: any) => Boolean(s._id || s.id))
          .map((s: any) => ({
            id: s.id || s._id,
            name: s.name,
            address: s.address,
            priceUnit: s.priceUnit ?? "hour",
            lat: s.location?.coordinates?.[1] ?? s.lat ?? 0,
            lng: s.location?.coordinates?.[0] ?? s.lng ?? 0,
            total: s.total ?? 0,
            available: s.available ?? s.total ?? 0,
            price: s.price ?? 0,
            status: s.status ?? "active",
            distance: s.distance || "",
            isLive: true,
          }))
        setParkingSpots(normalized)
      } catch (err) {
        console.warn("Failed to fetch backend slots for map", err)
        setParkingSpots([])
      }
    }

    fetchSlots()

  // Subscribe to SSE for real-time slot.created/slot.updated events
    const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
    // include token as query param so EventSource can be authenticated
    const token = (window as any)?.localStorage?.getItem("auth_token")
    const streamUrl = token ? `${API_BASE}/api/slots/stream?token=${encodeURIComponent(token)}` : `${API_BASE}/api/slots/stream`
    const evtSrc = new EventSource(streamUrl)
    evtSrc.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data)
        const t = payload?.type
        if (t === "slot.created") {
          const s = payload.data
          const newSlot: ParkingSlot = {
            id: s.id || s._id,
            name: s.name,
            address: s.address,
            lat: s.location?.coordinates?.[1] ?? s.lat ?? 0,
            lng: s.location?.coordinates?.[0] ?? s.lng ?? 0,
            total: s.total ?? 0,
                available: s.available ?? s.total ?? 0,
            price: s.price ?? 0,
            status: s.status ?? "active",
                distance: s.distance || "",
                isLive: true,
          }
          setParkingSpots((prev) => {
            if (prev.find((p) => p.id === newSlot.id)) return prev
            return [...prev, newSlot]
          })
        } else if (t === "slot.updated") {
          const s = payload.data
          const updatedId = s.id || s._id
          setParkingSpots((prev) =>
            prev.map((p) => (p.id === updatedId ? { ...p, name: s.name ?? p.name, address: s.address ?? p.address, lat: s.location?.coordinates?.[1] ?? s.lat, lng: s.location?.coordinates?.[0] ?? s.lng, total: s.total ?? p.total, available: s.available ?? p.available, price: s.price ?? p.price, status: s.status ?? p.status } : p)),
          )
        }
      } catch (err) {
        console.warn("Failed to process SSE event", err)
      }
    }
    evtSrc.onerror = (err) => {
      console.warn("SSE connection error", err)
      // if needed: evtSrc.close()
    }

    return () => {
      evtSrc.close()
    }
  }, [])

  const getAvailabilityColor = (available: number) => (available > 0 ? "text-green-600" : "text-red-600")

  const handleNavigate = (spot: ParkingSlot) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${spot.lat},${spot.lng}`
    window.open(url, "_blank")
  }

  // no user-side filters; show all backend-provided slots

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background">
          <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/user/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Map View</h1>
          <div className="ml-auto" />
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="relative h-[600px]">
                  <Suspense
                    fallback={
                      <div className="h-[600px] bg-muted flex items-center justify-center">
                        <p className="text-muted-foreground">Loading map...</p>
                      </div>
                    }
                  >
                    <DynamicMap
                      center={userLocation}
                      parkingSpots={parkingSpots}
                      selectedSpot={selectedSpot}
                      onSpotSelect={setSelectedSpot}
                      activeBookings={activeBookings}
                    />
                  </Suspense>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Parking List Section */}
          <div className="lg:col-span-1">
            <div className="space-y-4 sticky top-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Nearby Parking</CardTitle>
                  <CardDescription>
                    {parkingSpots.length} location{parkingSpots.length !== 1 ? "s" : ""} found
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[550px] overflow-y-auto">
                  {parkingSpots.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No parking spots available</p>
                    </div>
                  ) : (
                    parkingSpots.map((spot) => {
                      const isActive = activeBookings.includes(spot.id)
                      return (
                        <Card
                          key={spot.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            selectedSpot === spot.id ? "ring-2 ring-primary" : ""
                          } ${isActive ? "border-purple-500 border-2" : ""}`}
                          onClick={() => setSelectedSpot(spot.id)}
                        >
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-sm mb-1">{spot.name}</h3>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {spot.address}
                                </p>
                              </div>
                              {spot.distance && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {spot.distance}
                                </Badge>
                              )}
                            </div>

                            {isActive && <Badge className="bg-purple-500 text-white text-xs">Active Booking</Badge>}

                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="font-semibold">${spot.price}</span>
                                <span className="text-muted-foreground">/hour</span>
                              </div>
                              <span className={`font-semibold ${getAvailabilityColor(spot.available)}`}>
                                {spot.available} available
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 h-8 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/user/booking/${spot.id}`)
                                }}
                              >
                                Book Now
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 bg-transparent"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleNavigate(spot)
                                }}
                              >
                                <Navigation className="h-3 w-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

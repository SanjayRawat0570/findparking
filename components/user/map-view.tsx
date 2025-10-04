"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { ArrowLeft, Search, MapPin, Navigation, Clock, Filter, X } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import dynamic from "next/dynamic"
import { parkingSlotsService, type ParkingSlot } from "@/lib/parking-slots"

const DynamicMap = dynamic(() => import("./enhanced-leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] bg-muted flex items-center justify-center">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  ),
})

export function MapView() {
  const router = useRouter()
  const [parkingSpots, setParkingSpots] = useState<ParkingSlot[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSpot, setSelectedSpot] = useState<string | null>(null)
  const [userLocation] = useState({ lat: 40.758, lng: -73.9855 }) // Mock user location (Times Square)
  const [priceRange, setPriceRange] = useState([0, 20])
  const [showAvailableOnly, setShowAvailableOnly] = useState(false)
  const [sortBy, setSortBy] = useState<"distance" | "price" | "availability">("distance")
  const [filteredSpots, setFilteredSpots] = useState<ParkingSlot[]>([])
  const [activeBookings] = useState(["1", "3"])

  useEffect(() => {
    setParkingSpots(parkingSlotsService.getSlots())

    // Subscribe to real-time updates when admin adds/removes slots
    const unsubscribe = parkingSlotsService.subscribe(() => {
      console.log("[v0] Parking slots updated, refreshing user view")
      setParkingSpots(parkingSlotsService.getSlots())
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    let filtered = [...parkingSpots]

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (spot) =>
          spot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          spot.address.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Filter by price range
    filtered = filtered.filter((spot) => spot.price >= priceRange[0] && spot.price <= priceRange[1])

    // Filter by availability
    if (showAvailableOnly) {
      filtered = filtered.filter((spot) => spot.available > 0)
    }

    // Sort results
    filtered.sort((a, b) => {
      if (sortBy === "distance") {
        // Parse distance if it exists, otherwise use 0
        const distA = Number.parseFloat(a.distance || "0")
        const distB = Number.parseFloat(b.distance || "0")
        return distA - distB
      } else if (sortBy === "price") {
        return a.price - b.price
      } else {
        return b.available - a.available
      }
    })

    setFilteredSpots(filtered)
  }, [searchQuery, priceRange, showAvailableOnly, sortBy, parkingSpots])

  const getAvailabilityColor = (available: number, total: number) => {
    const percentage = (available / total) * 100
    if (percentage > 50) return "text-green-600"
    if (percentage > 20) return "text-yellow-600"
    return "text-red-600"
  }

  const handleNavigate = (spot: ParkingSlot) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${spot.lat},${spot.lng}`
    window.open(url, "_blank")
  }

  const clearFilters = () => {
    setPriceRange([0, 20])
    setShowAvailableOnly(false)
    setSortBy("distance")
    setSearchQuery("")
  }

  const hasActiveFilters = priceRange[0] !== 0 || priceRange[1] !== 20 || showAvailableOnly || searchQuery.trim() !== ""

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/user/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Map View</h1>
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-auto">
              {filteredSpots.length} results
            </Badge>
          )}
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
                  <div className="absolute top-4 left-4 right-4 z-[1000] flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search location, address, or parking name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-background shadow-lg"
                      />
                    </div>
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="bg-background shadow-lg">
                          <Filter className="h-5 w-5" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader>
                          <SheetTitle>Filter Parking Spots</SheetTitle>
                          <SheetDescription>Refine your search with filters</SheetDescription>
                        </SheetHeader>
                        <div className="space-y-6 py-6">
                          {/* Price Range Filter */}
                          <div className="space-y-3">
                            <Label>Price Range (per hour)</Label>
                            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                              <span>${priceRange[0]}</span>
                              <span>${priceRange[1]}</span>
                            </div>
                            <Slider
                              min={0}
                              max={20}
                              step={1}
                              value={priceRange}
                              onValueChange={setPriceRange}
                              className="w-full"
                            />
                          </div>

                          {/* Availability Filter */}
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="available"
                              checked={showAvailableOnly}
                              onCheckedChange={(checked) => setShowAvailableOnly(checked as boolean)}
                            />
                            <Label htmlFor="available" className="cursor-pointer">
                              Show only available spots
                            </Label>
                          </div>

                          {/* Sort By */}
                          <div className="space-y-3">
                            <Label>Sort By</Label>
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="distance"
                                  checked={sortBy === "distance"}
                                  onCheckedChange={() => setSortBy("distance")}
                                />
                                <Label htmlFor="distance" className="cursor-pointer">
                                  Distance
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="price"
                                  checked={sortBy === "price"}
                                  onCheckedChange={() => setSortBy("price")}
                                />
                                <Label htmlFor="price" className="cursor-pointer">
                                  Price (Low to High)
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="availability"
                                  checked={sortBy === "availability"}
                                  onCheckedChange={() => setSortBy("availability")}
                                />
                                <Label htmlFor="availability" className="cursor-pointer">
                                  Availability
                                </Label>
                              </div>
                            </div>
                          </div>

                          {/* Clear Filters */}
                          {hasActiveFilters && (
                            <Button variant="outline" className="w-full bg-transparent" onClick={clearFilters}>
                              <X className="mr-2 h-4 w-4" />
                              Clear All Filters
                            </Button>
                          )}
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>

                  <DynamicMap
                    center={userLocation}
                    parkingSpots={filteredSpots}
                    selectedSpot={selectedSpot}
                    onSpotSelect={setSelectedSpot}
                    activeBookings={activeBookings}
                  />
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
                    {filteredSpots.length} location{filteredSpots.length !== 1 ? "s" : ""} found
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[550px] overflow-y-auto">
                  {filteredSpots.length === 0 ? (
                    <div className="text-center py-8">
                      <Search className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No parking spots match your filters</p>
                      <Button variant="link" onClick={clearFilters} className="mt-2">
                        Clear filters
                      </Button>
                    </div>
                  ) : (
                    filteredSpots.map((spot) => {
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
                              <span className={`font-semibold ${getAvailabilityColor(spot.available, spot.total)}`}>
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

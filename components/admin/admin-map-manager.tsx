"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { MapPin, Plus, Trash2, Edit } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import dynamic from "next/dynamic"

const DynamicMap = dynamic(() => import("./admin-leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] bg-muted flex items-center justify-center">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  ),
})

const DynamicGoogleMap = dynamic(() => import("./admin-google-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] bg-muted flex items-center justify-center">
      <p className="text-muted-foreground">Loading Google Maps...</p>
    </div>
  ),
})

interface ParkingSlot {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  total: number
  available: number
  price: number
  status: string
  isLive?: boolean
}

// initial empty list; we'll fetch from backend on mount
const mockSlots: ParkingSlot[] = []

export function AdminMapManager() {
  // normalize longitude into [-180,180]
  const normalizeLng = (lng: number) => {
    const raw = ((lng + 180) % 360 + 360) % 360
    return raw - 180
  }
  const { toast } = useToast()
  const [slots, setSlots] = useState<ParkingSlot[]>(mockSlots)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [isAddingMode, setIsAddingMode] = useState(false)
  const [isEditingMode, setIsEditingMode] = useState(false)
  const [newSlotLocation, setNewSlotLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [newSlotData, setNewSlotData] = useState({
    name: "",
    address: "",
    total: "",
    price: "",
  })
  const [center] = useState({ lat: 40.758, lng: -73.9855 })
  

  const handleMapClick = (lat: number, lng: number, address?: string) => {
    if (isAddingMode) {
      // set provisional UI state
      setNewSlotLocation({ lat, lng })
      const derivedName = address ? address.split(",")[0] : "New Parking Slot"
      const defaults = {
        name: derivedName,
        address: address ?? "",
        total: "50",
        price: "0",
      }
      setNewSlotData((prev) => ({ ...defaults, ...prev }))

      // auto-create the slot on the server (best-effort). If admin is logged in, include auth header.
      ;(async () => {
        const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null

        const payload = {
          name: defaults.name,
          // ensure address is not blank; fall back to lat,lng string
          address: (defaults.address && defaults.address.trim() !== "") ? defaults.address : `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          total: Number.parseInt(defaults.total),
          available: Number.parseInt(defaults.total),
          location: { type: "Point", coordinates: [normalizeLng(lng), lat] },
          status: "active",
          price: Number.parseInt(defaults.price),
        }

        const headers: any = { "Content-Type": "application/json" }
        if (token) headers["Authorization"] = `Bearer ${token}`

        try {
          const res = await fetch(`${API_BASE}/api/slots/`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          })
          if (res.ok) {
            const created = await res.json()
            const createdSlot: ParkingSlot = {
              id: created.id || String(slots.length + 1),
              name: created.name,
              address: created.address,
              lat: created.location?.coordinates?.[1] ?? lat,
              lng: created.location?.coordinates?.[0] ?? lng,
              total: created.total ?? payload.total,
              available: created.available ?? payload.available,
              price: created.price ?? payload.price,
              status: created.status ?? "active",
              isLive: true,
            }
            setSlots((s) => [...s, createdSlot])
            toast({ title: "Slot added", description: "Parking slot saved to server" })
          } else {
            // fallback local-only
            const localSlot: ParkingSlot = {
              id: String(slots.length + 1),
              name: payload.name,
              address: payload.address,
              lat,
              lng,
              total: payload.total,
              available: payload.available,
              price: payload.price,
              status: payload.status,
              isLive: false,
            }
            setSlots((s) => [...s, localSlot])
            toast({ title: "Offline: Slot added locally", description: "Server add failed; saved locally", variant: "destructive" })
          }
        } catch (err) {
          // network error -> fallback local add
          const localSlot: ParkingSlot = {
            id: String(slots.length + 1),
            name: payload.name,
            address: payload.address,
            lat,
            lng,
            total: payload.total,
            available: payload.available,
            price: payload.price,
            status: payload.status,
            isLive: false,
          }
          setSlots((s) => [...s, localSlot])
          toast({ title: "Offline: Slot added locally", description: "Network error; saved locally", variant: "destructive" })
        } finally {
          // reset add mode UI
          setIsAddingMode(false)
          setNewSlotLocation(null)
          setNewSlotData({ name: "", address: "", total: "", price: "" })
        }
      })()
    } else if (isEditingMode && selectedSlot) {
      // update selected slot's location/address
      setSlots((prev) =>
        prev.map((s) =>
          s.id === selectedSlot
            ? {
                ...s,
                lat,
                lng,
                address: address ?? s.address,
                // if name empty, derive from address
                name: s.name && s.name.trim() !== "" ? s.name : address ? address.split(",")[0] : s.name,
              }
            : s,
        ),
      )
      toast({
        title: "Location updated",
        description: "Selected slot location was updated on the map",
      })
    }
  }

  // fetch live slots from backend on mount
  useEffect(() => {
    ;(async () => {
      try {
        const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
        const res = await fetch(`${API_BASE}/api/slots/`)
        if (!res.ok) throw new Error("failed to fetch slots")
        const data = await res.json()
        const normalized: ParkingSlot[] = (data || []).map((s: any) => ({
          id: s.id || s._id,
          name: s.name,
          address: s.address,
          lat: s.location?.coordinates?.[1] ?? s.lat ?? 0,
          lng: s.location?.coordinates?.[0] ?? s.lng ?? 0,
          total: s.total ?? 0,
          available: s.available ?? s.total ?? 0,
          price: s.price ?? 0,
          status: s.status ?? "active",
          isLive: true,
        }))
        setSlots(normalized)
      } catch (err) {
        console.warn("Failed to fetch slots for admin map", err)
      }
    })()
  }, [])

  

  const handleAddSlot = () => {
    if (!newSlotLocation || !newSlotData.name || !newSlotData.address || !newSlotData.total || !newSlotData.price) {
      toast({
        title: "Missing information",
        description: "Please select a location and fill in all fields",
        variant: "destructive",
      })
      return
    }

    const newSlot: ParkingSlot = {
      id: String(slots.length + 1),
      name: newSlotData.name,
      address: newSlotData.address,
      lat: newSlotLocation.lat,
      lng: newSlotLocation.lng,
      total: Number.parseInt(newSlotData.total),
      available: Number.parseInt(newSlotData.total),
      price: Number.parseInt(newSlotData.price),
      status: "active",
    }

    // Try to persist to backend
    ;(async () => {
      try {
        const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
        const payload = {
          name: newSlot.name,
          address: newSlot.address,
          total: newSlot.total,
          available: newSlot.available,
          location: { type: "Point", coordinates: [normalizeLng(newSlot.lng), newSlot.lat] },
          status: newSlot.status,
          price: newSlot.price,
        }

        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
        const headers: any = { "Content-Type": "application/json" }
        if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/api/slots/`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          const created = await res.json()
          // backend returns the created slot; adapt shape to frontend ParkingSlot
          const createdSlot: ParkingSlot = {
            id: created.id || String(slots.length + 1),
            name: created.name,
            address: created.address,
            lat: created.location?.coordinates?.[1] ?? newSlot.lat,
            lng: created.location?.coordinates?.[0] ?? newSlot.lng,
            total: created.total ?? newSlot.total,
            available: created.available ?? newSlot.available,
            price: created.price ?? newSlot.price,
            status: created.status ?? newSlot.status,
          }
          setSlots((s) => [...s, createdSlot])
        } else {
          // fallback to local-only add
          setSlots([...slots, newSlot])
        }
      } catch (e) {
        // network error -> fallback local add
        setSlots([...slots, newSlot])
      }
    })()
    setIsAddingMode(false)
    setNewSlotLocation(null)
    setNewSlotData({ name: "", address: "", total: "", price: "" })

    toast({
      title: "Slot added",
      description: "New parking slot has been added successfully",
    })
  }

  const handleDeleteSlot = (id: string) => {
    setSlots(slots.filter((slot) => slot.id !== id))
    if (selectedSlot === id) {
      setSelectedSlot(null)
    }
    toast({
      title: "Slot deleted",
      description: "Parking slot has been removed",
    })
  }

  const selectedSlotData = slots.find((s) => s.id === selectedSlot)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Map Management</h2>
          <p className="text-muted-foreground">Add, edit, and manage parking slots on the map</p>
        </div>
        <Button
          onClick={() => {
            setIsAddingMode(!isAddingMode)
            setNewSlotLocation(null)
          }}
          variant={isAddingMode ? "destructive" : "default"}
        >
          {isAddingMode ? (
            "Cancel"
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add Slot on Map
            </>
          )}
        </Button>
        <Button
          onClick={async () => {
            // find local-only slots
                const localOnly = slots.filter((s) => s.isLive === false || s.isLive === undefined)
            if (localOnly.length === 0) {
              toast({ title: "Nothing to sync", description: "All slots are already live" })
              return
            }
                const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
                const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
                if (!token) {
                  toast({ title: "Missing auth", description: "Please sign in as admin to sync local slots", variant: "destructive" })
                  return
                }
                const headers: any = { "Content-Type": "application/json", Authorization: `Bearer ${token}` }

                let successCount = 0
                const failed: { id: string; reason: string }[] = []
                for (const s of localOnly) {
                  try {
                    const payload = {
                      name: s.name || `Slot ${s.id}`,
                      address: s.address && s.address.trim() !== "" ? s.address : `${s.lat.toFixed(6)}, ${s.lng.toFixed(6)}`,
                      total: s.total || 1,
                      available: s.available || Math.max(1, s.total || 1),
                      location: { type: "Point", coordinates: [normalizeLng(s.lng), s.lat] },
                      status: s.status || "active",
                      price: s.price || 0,
                    }
                    const res = await fetch(`${API_BASE}/api/slots/`, { method: "POST", headers, body: JSON.stringify(payload) })
                    if (res.ok) {
                      const created = await res.json()
                      // mark slot live locally and update id if server returned one
                      setSlots((prev) => prev.map((ps) => (ps.id === s.id ? { ...ps, isLive: true, id: created.id ?? ps.id } : ps)))
                      successCount++
                    } else {
                      const text = await res.text()
                      failed.push({ id: s.id, reason: text || `status ${res.status}` })
                    }
                  } catch (err: any) {
                    console.warn("Sync slot failed", err)
                    failed.push({ id: s.id, reason: err?.message || "network error" })
                  }
                }
                toast({ title: `Sync complete`, description: `${successCount}/${localOnly.length} slots synced` })
                if (failed.length > 0) {
                  console.warn("Sync failures:", failed)
                  toast({ title: `Sync failures`, description: `${failed.length} slots failed to sync. Check console for details.`, variant: "destructive" })
                }
          }
        }
        >
          Sync Local
        </Button>
      </div>

      {isAddingMode && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg">Adding New Slot</CardTitle>
            <CardDescription>Click on the map to select a location, then fill in the details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {newSlotLocation && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                <MapPin className="inline h-4 w-4 mr-1" />
                Location: {newSlotLocation.lat.toFixed(6)}, {newSlotLocation.lng.toFixed(6)}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Location Name</Label>
                <Input
                  id="name"
                  placeholder="Downtown Parking Plaza"
                  value={newSlotData.name}
                  onChange={(e) => setNewSlotData({ ...newSlotData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St, Downtown"
                  value={newSlotData.address}
                  onChange={(e) => setNewSlotData({ ...newSlotData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total">Total Spots</Label>
                <Input
                  id="total"
                  type="number"
                  placeholder="50"
                  value={newSlotData.total}
                  onChange={(e) => setNewSlotData({ ...newSlotData, total: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price per Hour ($)</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="5"
                  value={newSlotData.price}
                  onChange={(e) => setNewSlotData({ ...newSlotData, price: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleAddSlot} className="w-full">
              Add Parking Slot
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="h-[600px]">
                <DynamicMap
                  center={center}
                  parkingSlots={slots}
                  selectedSlot={selectedSlot}
                  onSpotSelect={setSelectedSlot}
                  onMapClick={handleMapClick}
                  isAddingMode={isAddingMode}
                  newSlotLocation={newSlotLocation}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Slot Details</CardTitle>
              <CardDescription>
                {selectedSlotData ? "Manage selected parking slot" : "Select a slot on the map"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedSlotData ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{selectedSlotData.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedSlotData.address}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Spots</p>
                      <p className="text-lg font-semibold">{selectedSlotData.total}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="text-lg font-semibold text-green-600">{selectedSlotData.available}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="text-lg font-semibold">${selectedSlotData.price}/hr</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        {selectedSlotData.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex gap-2">
                      <Button
                        variant={isEditingMode ? "destructive" : "outline"}
                        className="flex-1"
                        size="sm"
                        onClick={() => setIsEditingMode((v) => !v)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        {isEditingMode ? "Cancel Edit" : "Edit Details"}
                      </Button>
                      {isEditingMode && selectedSlotData && (
                        <Button
                          className="flex-1"
                          size="sm"
                          onClick={async () => {
                            // persist selected slot updates to backend
                            try {
                              const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
                              const payload: any = {
                                name: selectedSlotData.name,
                                address: selectedSlotData.address,
                                total: selectedSlotData.total,
                                available: selectedSlotData.available,
                                price: selectedSlotData.price,
                                status: selectedSlotData.status,
                                location: { type: "Point", coordinates: [normalizeLng(selectedSlotData.lng), selectedSlotData.lat] },
                              }
                              const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
                              const headers: any = { "Content-Type": "application/json" }
                              if (token) headers["Authorization"] = `Bearer ${token}`
                              const res = await fetch(`${API_BASE}/api/slots/${selectedSlotData.id}`, {
                                method: "PATCH",
                                headers,
                                body: JSON.stringify(payload),
                              })
                              if (res.ok) {
                                const updated = await res.json()
                                // update local list with any server-normalized fields
                                setSlots((prev) => prev.map((s) => (s.id === selectedSlotData.id ? { ...s, ...updated } : s)))
                                setIsEditingMode(false)
                                toast({ title: "Saved", description: "Slot updated on server" })
                              } else {
                                throw new Error("failed to save")
                              }
                            } catch (err) {
                              console.warn(err)
                              toast({ title: "Save failed", description: "Could not save slot to server", variant: "destructive" })
                            }
                          }}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      className="w-full"
                      size="sm"
                      onClick={() => handleDeleteSlot(selectedSlotData.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Slot
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Click on a marker to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

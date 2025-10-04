"use client"

import { useState } from "react"
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
}

const mockSlots: ParkingSlot[] = [
  {
    id: "1",
    name: "Downtown Parking Plaza",
    address: "123 Main St, Downtown",
    lat: 40.7589,
    lng: -73.9851,
    total: 50,
    available: 12,
    price: 5,
    status: "active",
  },
  {
    id: "2",
    name: "City Center Garage",
    address: "456 Center Ave, City Center",
    lat: 40.7614,
    lng: -73.9776,
    total: 100,
    available: 5,
    price: 8,
    status: "active",
  },
  {
    id: "3",
    name: "Mall Parking Lot",
    address: "789 Shopping Blvd, West Side",
    lat: 40.7549,
    lng: -73.984,
    total: 200,
    available: 45,
    price: 3,
    status: "active",
  },
]

export function AdminMapManager() {
  const { toast } = useToast()
  const [slots, setSlots] = useState<ParkingSlot[]>(mockSlots)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [isAddingMode, setIsAddingMode] = useState(false)
  const [newSlotLocation, setNewSlotLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [newSlotData, setNewSlotData] = useState({
    name: "",
    address: "",
    total: "",
    price: "",
  })
  const [center] = useState({ lat: 40.758, lng: -73.9855 })

  const handleMapClick = (lat: number, lng: number) => {
    if (isAddingMode) {
      setNewSlotLocation({ lat, lng })
      toast({
        title: "Location selected",
        description: "Fill in the details to add this parking slot",
      })
    }
  }

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

    setSlots([...slots, newSlot])
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
                    <Button variant="outline" className="w-full bg-transparent" size="sm">
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Details
                    </Button>
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

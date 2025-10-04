"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle, Edit, Trash2, MapPin } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { parkingSlotsService, type ParkingSlot } from "@/lib/parking-slots"

export function SlotsTab() {
  const { toast } = useToast()
  const [slots, setSlots] = useState<ParkingSlot[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newSlot, setNewSlot] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    total: "",
    price: "",
  })

  useEffect(() => {
    setSlots(parkingSlotsService.getSlots())

    // Subscribe to updates
    const unsubscribe = parkingSlotsService.subscribe(() => {
      setSlots(parkingSlotsService.getSlots())
    })

    return unsubscribe
  }, [])

  const handleAddSlot = () => {
    if (!newSlot.name || !newSlot.address || !newSlot.total || !newSlot.price) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    parkingSlotsService.addSlot({
      name: newSlot.name,
      address: newSlot.address,
      lat: Number.parseFloat(newSlot.lat) || 40.7128,
      lng: Number.parseFloat(newSlot.lng) || -74.006,
      total: Number.parseInt(newSlot.total),
      available: Number.parseInt(newSlot.total),
      price: Number.parseInt(newSlot.price),
      status: "active",
    })

    setIsAddDialogOpen(false)
    setNewSlot({ name: "", address: "", lat: "", lng: "", total: "", price: "" })

    toast({
      title: "Slot added",
      description: "New parking slot has been added and is now visible to all users",
    })
  }

  const handleDeleteSlot = (id: string) => {
    parkingSlotsService.deleteSlot(id)
    toast({
      title: "Slot deleted",
      description: "Parking slot has been removed",
    })
  }

  const getOccupancyColor = (available: number, total: number) => {
    const percentage = (available / total) * 100
    if (percentage > 50) return "text-green-600"
    if (percentage > 20) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Parking Slots</h2>
          <p className="text-muted-foreground">Manage your parking locations and availability</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Slot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Parking Slot</DialogTitle>
              <DialogDescription>Create a new parking location</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Location Name</Label>
                <Input
                  id="name"
                  placeholder="Downtown Parking Plaza"
                  value={newSlot.name}
                  onChange={(e) => setNewSlot({ ...newSlot, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St, Downtown"
                  value={newSlot.address}
                  onChange={(e) => setNewSlot({ ...newSlot, address: e.target.value })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lat">Latitude</Label>
                  <Input
                    id="lat"
                    type="number"
                    step="any"
                    placeholder="40.7128"
                    value={newSlot.lat}
                    onChange={(e) => setNewSlot({ ...newSlot, lat: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng">Longitude</Label>
                  <Input
                    id="lng"
                    type="number"
                    step="any"
                    placeholder="-74.0060"
                    value={newSlot.lng}
                    onChange={(e) => setNewSlot({ ...newSlot, lng: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="total">Total Spots</Label>
                  <Input
                    id="total"
                    type="number"
                    placeholder="50"
                    value={newSlot.total}
                    onChange={(e) => setNewSlot({ ...newSlot, total: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price per Hour ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="5"
                    value={newSlot.price}
                    onChange={(e) => setNewSlot({ ...newSlot, price: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSlot}>Add Slot</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Parking Locations ({slots.length})</CardTitle>
          <CardDescription>View and manage all parking slots</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slots.map((slot) => (
                <TableRow key={slot.id}>
                  <TableCell className="font-medium">{slot.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {slot.address}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={getOccupancyColor(slot.available, slot.total)}>
                      {slot.available}/{slot.total}
                    </span>
                  </TableCell>
                  <TableCell>${slot.price}/hr</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                    >
                      {slot.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSlot(slot.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}

"use client"

export interface ParkingSlot {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  total: number
  available: number
  price: number
  priceUnit?: string
  status: "active" | "inactive"
  distance?: string
  isLive?: boolean
}

const STORAGE_KEY = "parking_slots"

// Initialize with default slots
const defaultSlots: ParkingSlot[] = [
  {
    id: "1",
    name: "Downtown Parking Plaza",
    address: "123 Main St, Downtown",
    lat: 40.7128,
    lng: -74.006,
    total: 50,
    available: 12,
    price: 5,
    status: "active",
    distance: "0.5 km",
    isLive: true,
  },
  {
    id: "2",
    name: "City Center Garage",
    address: "456 Center Ave, City Center",
    lat: 40.7589,
    lng: -73.9851,
    total: 100,
    available: 5,
    price: 8,
    status: "active",
    distance: "1.2 km",
  },
  {
    id: "3",
    name: "Mall Parking Lot",
    address: "789 Shopping Blvd, West Side",
    lat: 40.7489,
    lng: -73.968,
    total: 200,
    available: 45,
    price: 3,
    status: "active",
    distance: "2.1 km",
  },
  {
    id: "4",
    name: "Airport Long-Term",
    address: "321 Airport Rd, Airport",
    lat: 40.6413,
    lng: -73.7781,
    total: 300,
    available: 89,
    price: 15,
    status: "active",
    distance: "15.3 km",
    isLive: true,
  },
]

export const parkingSlotsService = {
  // Get all slots
  getSlots: (): ParkingSlot[] => {
    if (typeof window === "undefined") return defaultSlots

    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSlots))
      return defaultSlots
    }
    return JSON.parse(stored)
  },

  // Add new slot
  addSlot: (slot: Omit<ParkingSlot, "id">): ParkingSlot => {
    const slots = parkingSlotsService.getSlots()
    const newSlot = {
      ...slot,
      id: String(Date.now()),
      isLive: false,
    }
    const updatedSlots = [...slots, newSlot]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSlots))

    // Trigger storage event for cross-component updates
    window.dispatchEvent(new Event("parking-slots-updated"))

    return newSlot
  },

  // Update slot
  updateSlot: (id: string, updates: Partial<ParkingSlot>): void => {
    const slots = parkingSlotsService.getSlots()
    const updatedSlots = slots.map((slot) => (slot.id === id ? { ...slot, ...updates } : slot))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSlots))
    window.dispatchEvent(new Event("parking-slots-updated"))
  },

  // Delete slot
  deleteSlot: (id: string): void => {
    const slots = parkingSlotsService.getSlots()
    const updatedSlots = slots.filter((slot) => slot.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSlots))
    window.dispatchEvent(new Event("parking-slots-updated"))
  },

  // Subscribe to slot updates
  subscribe: (callback: () => void): (() => void) => {
    window.addEventListener("parking-slots-updated", callback)
    return () => window.removeEventListener("parking-slots-updated", callback)
  },
}

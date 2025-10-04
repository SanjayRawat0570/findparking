"use client"

import { useEffect, useRef } from "react"

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

interface AdminLeafletMapProps {
  center: { lat: number; lng: number }
  parkingSlots: ParkingSlot[]
  selectedSlot: string | null
  onSpotSelect: (id: string) => void
  onMapClick: (lat: number, lng: number) => void
  isAddingMode: boolean
  newSlotLocation: { lat: number; lng: number } | null
}

export default function AdminLeafletMap({
  center,
  parkingSlots,
  selectedSlot,
  onSpotSelect,
  onMapClick,
  isAddingMode,
  newSlotLocation,
}: AdminLeafletMapProps) {
  const mapRef = useRef<any>(null)
  const markersRef = useRef<{ [key: string]: any }>({})
  const mapInstanceRef = useRef<any>(null)
  const newMarkerRef = useRef<any>(null)

  useEffect(() => {
    let L: any

    const initMap = async () => {
      L = (await import("leaflet")).default

      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        link.crossOrigin = ""
        document.head.appendChild(link)
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      if (!mapInstanceRef.current && mapRef.current) {
        mapInstanceRef.current = L.map(mapRef.current).setView([center.lat, center.lng], 13)

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current)

        // Add click handler for adding new slots
        mapInstanceRef.current.on("click", (e: any) => {
          if (isAddingMode) {
            onMapClick(e.latlng.lat, e.latlng.lng)
          }
        })
      }

      // Clear existing markers
      Object.values(markersRef.current).forEach((marker: any) => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(marker)
        }
      })
      markersRef.current = {}

      // Add parking slot markers
      parkingSlots.forEach((slot) => {
        if (mapInstanceRef.current) {
          const occupancyPercentage = ((slot.total - slot.available) / slot.total) * 100
          const heatColor = occupancyPercentage > 80 ? "#ef4444" : occupancyPercentage > 50 ? "#eab308" : "#22c55e"

          const markerIcon = L.divIcon({
            className: "custom-admin-marker",
            html: `
              <div style="position: relative;">
                <div style="
                  background: ${heatColor}; 
                  width: 36px; 
                  height: 36px; 
                  border-radius: 50%; 
                  border: 3px solid white;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                ">
                  <span style="
                    color: white;
                    font-weight: bold;
                    font-size: 14px;
                  ">${slot.total - slot.available}</span>
                </div>
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          })

          const marker = L.marker([slot.lat, slot.lng], { icon: markerIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup(
              `
              <div style="min-width: 220px;">
                <h3 style="font-weight: bold; margin-bottom: 8px;">${slot.name}</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 8px;">${slot.address}</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                  <div>
                    <p style="font-size: 10px; color: #999;">Occupied</p>
                    <p style="font-weight: 600;">${slot.total - slot.available}/${slot.total}</p>
                  </div>
                  <div>
                    <p style="font-size: 10px; color: #999;">Price</p>
                    <p style="font-weight: 600;">$${slot.price}/hr</p>
                  </div>
                </div>
              </div>
            `,
            )
            .on("click", () => {
              if (!isAddingMode) {
                onSpotSelect(slot.id)
              }
            })

          markersRef.current[slot.id] = marker
        }
      })

      // Add new slot marker if in adding mode
      if (newMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(newMarkerRef.current)
        newMarkerRef.current = null
      }

      if (newSlotLocation && mapInstanceRef.current) {
        const newMarkerIcon = L.divIcon({
          className: "custom-new-marker",
          html: `
            <div style="
              background: #3b82f6; 
              width: 40px; 
              height: 40px; 
              border-radius: 50%; 
              border: 4px solid white;
              box-shadow: 0 2px 12px rgba(59, 130, 246, 0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              animation: bounce 1s infinite;
            ">
              <span style="color: white; font-weight: bold; font-size: 20px;">+</span>
            </div>
            <style>
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
              }
            </style>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        })

        newMarkerRef.current = L.marker([newSlotLocation.lat, newSlotLocation.lng], { icon: newMarkerIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup("<b>New Slot Location</b><br>Fill in the details to add")
          .openPopup()
      }

      // Highlight selected slot
      if (selectedSlot && markersRef.current[selectedSlot]) {
        markersRef.current[selectedSlot].openPopup()
      }
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersRef.current = {}
        newMarkerRef.current = null
      }
    }
  }, [center, parkingSlots, selectedSlot, onSpotSelect, onMapClick, isAddingMode, newSlotLocation])

  return <div ref={mapRef} className="h-full w-full" />
}

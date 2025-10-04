"use client"

import { useEffect, useRef } from "react"

interface ParkingSpot {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  distance: string
  price: number
  priceUnit: string
  available: number
  total: number
}

interface LeafletMapProps {
  center: { lat: number; lng: number }
  parkingSpots: ParkingSpot[]
  selectedSpot: string | null
  onSpotSelect: (id: string) => void
}

export default function LeafletMap({ center, parkingSpots, selectedSpot, onSpotSelect }: LeafletMapProps) {
  const mapRef = useRef<any>(null)
  const markersRef = useRef<{ [key: string]: any }>({})
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    let L: any

    const initMap = async () => {
      // Dynamically import Leaflet
      L = (await import("leaflet")).default

      // Load Leaflet CSS
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        link.crossOrigin = ""
        document.head.appendChild(link)
      }

      // Fix for default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      // Initialize map
      if (!mapInstanceRef.current && mapRef.current) {
        mapInstanceRef.current = L.map(mapRef.current).setView([center.lat, center.lng], 13)

        // Add OpenStreetMap tiles (Free!)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current)

        // Add user location marker
        const userIcon = L.divIcon({
          className: "custom-user-marker",
          html: `<div style="background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })

        L.marker([center.lat, center.lng], { icon: userIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup("<b>Your Location</b>")
      }

      // Add parking spot markers
      parkingSpots.forEach((spot) => {
        if (!markersRef.current[spot.id] && mapInstanceRef.current) {
          const availabilityColor =
            (spot.available / spot.total) * 100 > 50
              ? "#22c55e"
              : (spot.available / spot.total) * 100 > 20
                ? "#eab308"
                : "#ef4444"

          const markerIcon = L.divIcon({
            className: "custom-parking-marker",
            html: `
              <div style="position: relative;">
                <div style="
                  background: ${availabilityColor}; 
                  width: 32px; 
                  height: 32px; 
                  border-radius: 50% 50% 50% 0; 
                  transform: rotate(-45deg);
                  border: 3px solid white;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                ">
                  <span style="
                    transform: rotate(45deg);
                    color: white;
                    font-weight: bold;
                    font-size: 16px;
                  ">P</span>
                </div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32],
          })

          const marker = L.marker([spot.lat, spot.lng], { icon: markerIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup(
              `
              <div style="min-width: 200px;">
                <h3 style="font-weight: bold; margin-bottom: 8px;">${spot.name}</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 8px;">${spot.address}</p>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-weight: 600;">$${spot.price}/${spot.priceUnit}</span>
                  <span style="color: ${availabilityColor}; font-weight: 600;">${spot.available} available</span>
                </div>
              </div>
            `,
            )
            .on("click", () => {
              onSpotSelect(spot.id)
            })

          markersRef.current[spot.id] = marker
        }
      })

      // Highlight selected spot
      if (selectedSpot && markersRef.current[selectedSpot]) {
        markersRef.current[selectedSpot].openPopup()
      }
    }

    initMap()

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersRef.current = {}
      }
    }
  }, [center, parkingSpots, selectedSpot, onSpotSelect])

  return <div ref={mapRef} className="h-full w-full" />
}

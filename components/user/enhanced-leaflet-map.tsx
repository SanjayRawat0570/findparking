"use client"

import { useEffect, useRef, useState } from "react"

interface ParkingSpot {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  distance: string
  price: number
  priceUnit?: string
  available: number
  total: number
}

interface EnhancedLeafletMapProps {
  center: { lat: number; lng: number }
  parkingSpots: ParkingSpot[]
  selectedSpot: string | null
  onSpotSelect: (id: string) => void
  activeBookings?: string[]
  showControls?: boolean
}

export default function EnhancedLeafletMap({
  center,
  parkingSpots,
  selectedSpot,
  onSpotSelect,
  activeBookings = [],
  showControls = true,
}: EnhancedLeafletMapProps) {
  const mapRef = useRef<any>(null)
  const markersRef = useRef<{ [key: string]: any }>({})
  const mapInstanceRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const [userLocation, setUserLocation] = useState(center)

  useEffect(() => {
    let L: any

    const initMap = async () => {
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
        mapInstanceRef.current = L.map(mapRef.current, {
          zoomControl: showControls,
        }).setView([center.lat, center.lng], 13)

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current)

        const userIcon = L.divIcon({
          className: "custom-user-marker",
          html: `
            <div style="position: relative;">
              <div style="
                background: #3b82f6; 
                width: 16px; 
                height: 16px; 
                border-radius: 50%; 
                border: 3px solid white; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                position: relative;
                z-index: 2;
              "></div>
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background: rgba(59, 130, 246, 0.3);
                animation: pulse 2s infinite;
              "></div>
            </div>
            <style>
              @keyframes pulse {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
              }
            </style>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })

        userMarkerRef.current = L.marker([center.lat, center.lng], { icon: userIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup("<b>Your Location</b>")

        if (showControls) {
          const locateControl = L.control({ position: "topright" })
          locateControl.onAdd = () => {
            const div = L.DomUtil.create("div", "leaflet-bar leaflet-control")
            div.innerHTML = `
              <a href="#" style="
                background: white;
                width: 34px;
                height: 34px;
                display: flex;
                align-items: center;
                justify-content: center;
                text-decoration: none;
                color: #333;
                font-size: 18px;
              " title="Get current location">📍</a>
            `
            div.onclick = (e: any) => {
              e.preventDefault()
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const newLat = position.coords.latitude
                    const newLng = position.coords.longitude
                    setUserLocation({ lat: newLat, lng: newLng })
                    if (mapInstanceRef.current && userMarkerRef.current) {
                      mapInstanceRef.current.setView([newLat, newLng], 13)
                      userMarkerRef.current.setLatLng([newLat, newLng])
                    }
                  },
                  (error) => {
                    console.error("Error getting location:", error)
                  },
                )
              }
            }
            return div
          }
          locateControl.addTo(mapInstanceRef.current)
        }
      }

      Object.values(markersRef.current).forEach((marker: any) => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(marker)
        }
      })
      markersRef.current = {}

      parkingSpots.forEach((spot) => {
        if (mapInstanceRef.current) {
          const isActive = activeBookings.includes(spot.id)
          const availabilityPercentage = (spot.available / Math.max(1, spot.total)) * 100
          // green when available, yellow when low, red when none
          // if slot isLive, prefer a green live indicator
          const availabilityColor = spot.isLive ? "#16a34a" : spot.available === 0 ? "#ef4444" : availabilityPercentage > 50 ? "#22c55e" : availabilityPercentage > 20 ? "#eab308" : "#ef4444"

          const markerIcon = L.divIcon({
            className: "custom-parking-marker",
            html: `
              <div style="position: relative;">
                  <div style="
                    background: ${isActive ? "#8b5cf6" : availabilityColor}; 
                    width: ${isActive ? "40px" : "32px"}; 
                    height: ${isActive ? "40px" : "32px"}; 
                    border-radius: 50% 50% 50% 0; 
                    transform: rotate(-45deg);
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                  ">
                    <span style="
                      transform: rotate(45deg);
                      color: white;
                      font-weight: bold;
                      font-size: ${isActive ? "20px" : "16px"};
                    ">P</span>
                  </div>
                  ${isActive ? `
                    <div style="
                      position: absolute;
                      top: -5px;
                      right: -5px;
                      background: #8b5cf6;
                      color: white;
                      border-radius: 50%;
                      width: 16px;
                      height: 16px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 10px;
                      border: 2px solid white;
                      transform: rotate(45deg);
                    ">✓</div>
                  ` : spot.available === 0 ? `
                    <div style="
                      position: absolute;
                      top: -8px;
                      right: -8px;
                      background: #ef4444;
                      color: white;
                      border-radius: 4px;
                      padding: 2px 6px;
                      font-size: 10px;
                      font-weight: 700;
                      border: 2px solid white;
                      transform: rotate(0deg);
                    ">BOOKED</div>
                  ` : ""}
                </div>
            `,
            iconSize: [isActive ? 40 : 32, isActive ? 40 : 32],
            iconAnchor: [isActive ? 20 : 16, isActive ? 40 : 32],
            popupAnchor: [0, isActive ? -40 : -32],
          })

          const marker = L.marker([spot.lat, spot.lng], { icon: markerIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup(
              `
              <div style="min-width: 220px; font-family: system-ui, -apple-system, sans-serif;">
                <h3 style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">${spot.name}</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 8px; line-height: 1.4;">${spot.address}</p>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding: 8px; background: #f5f5f5; border-radius: 4px;">
                  <span style="font-weight: 600; font-size: 13px;">$${spot.price}/${spot.priceUnit ?? 'hour'}</span>
                  <span style="color: ${availabilityColor}; font-weight: 600; font-size: 13px;">${spot.available} available</span>
                </div>
                ${
                  isActive
                    ? '<div style="background: #8b5cf6; color: white; padding: 4px 8px; border-radius: 4px; text-align: center; font-size: 11px; font-weight: 600;">ACTIVE BOOKING</div>'
                    : spot.isLive
                    ? '<div style="background: #16a34a; color: white; padding: 4px 8px; border-radius: 4px; text-align: center; font-size: 11px; font-weight: 600;">LIVE</div>'
                    : ""
                }
                <div style="margin-top: 8px; font-size: 11px; color: #999;">
                  Distance: ${spot.distance}
                </div>
              </div>
            `,
              {
                maxWidth: 250,
              },
            )
            .on("click", () => {
              onSpotSelect(spot.id)
            })

          markersRef.current[spot.id] = marker
        }
      })

      if (selectedSpot && markersRef.current[selectedSpot]) {
        markersRef.current[selectedSpot].openPopup()
        if (mapInstanceRef.current) {
          const spot = parkingSpots.find((s) => s.id === selectedSpot)
          if (spot) {
            mapInstanceRef.current.setView([spot.lat, spot.lng], 15)
          }
        }
      }
    }

    initMap()

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersRef.current = {}
        userMarkerRef.current = null
      }
    }
  }, [center, parkingSpots, selectedSpot, onSpotSelect, activeBookings, showControls])

  return <div ref={mapRef} className="h-full w-full" />
}

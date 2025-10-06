"use client"

import { useEffect, useRef, useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface ParkingSpot {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  distance?: string
  price: number
  priceUnit?: string
  available: number
  total: number
  isLive?: boolean
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
  const { toast } = useToast()

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

      // If a popup is open, close it first. Removing marker layers while a popup
      // references them can cause Leaflet to access internal fields like
      // `_leaflet_pos` on removed DOM nodes and throw. Closing the popup avoids
      // that race.
      try {
        if (mapInstanceRef.current && typeof mapInstanceRef.current.closePopup === "function") {
          // close any open popup first
          mapInstanceRef.current.closePopup()
        }
      } catch (err) {
        console.warn("Failed to close popup during marker cleanup", err)
      }

      // Defer actual marker removals a tick to avoid a race where Leaflet still
      // references marker internals (like _leaflet_pos) while DOM nodes are
      // being removed. This is a pragmatic workaround for intermittent
      // "Cannot read properties of undefined (reading '_leaflet_pos')" errors.
      setTimeout(() => {
        Object.values(markersRef.current).forEach((marker: any) => {
          try {
            // only attempt removal if marker appears to be a Leaflet layer
            if (marker && typeof marker.remove === "function") {
              marker.remove()
            } else if (mapInstanceRef.current) {
              mapInstanceRef.current.removeLayer(marker)
            }
          } catch (err) {
            console.warn("Failed to remove marker during cleanup", err)
          }
        })
        markersRef.current = {}
      }, 50)

      parkingSpots.forEach((spot) => {
        if (mapInstanceRef.current) {
          const isActive = activeBookings.includes(spot.id)
          const availabilityPercentage = (spot.available / Math.max(1, spot.total)) * 100
          // green when available, yellow when low, red when none
          // if slot isLive, show a blue live indicator so admin-created slots stand out
          const availabilityColor = spot.isLive ? "#3b82f6" : spot.available === 0 ? "#ef4444" : availabilityPercentage > 50 ? "#22c55e" : availabilityPercentage > 20 ? "#eab308" : "#ef4444"

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
          ? '<div style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; text-align: center; font-size: 11px; font-weight: 600;">LIVE</div>'
                    : ""
                }
                <div style="margin-top: 8px; font-size: 11px; color: #999;">
                  Distance: ${spot.distance}
                </div>
                <div style="margin-top: 8px; display:flex; gap:8px;">
                  ${spot.available > 0 ? `<button data-book-id="${spot.id}" style="flex:1; background:#3b82f6; color:white; border:none; padding:8px; border-radius:6px; font-weight:600;">Book</button>` : `<button disabled style="flex:1; background:#ddd; color:#666; border:none; padding:8px; border-radius:6px;">Unavailable</button>`}
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
            // handle popupopen to attach booking handler to the Book button
            .on("popupopen", (e: any) => {
              try {
                const popupNode = e.popup.getElement()
                if (!popupNode) return
                const btn: HTMLButtonElement | null = popupNode.querySelector(`button[data-book-id="${spot.id}"]`)
                if (!btn) return
                // remove previous handler to avoid duplication
                btn.onclick = async (ev: any) => {
                  ev.preventDefault()
                  // prevent booking local-only slots
                  if (!spot.isLive) {
                    toast({ title: "Cannot book", description: "This slot is not live on the server. Please sync it from the admin.", variant: "destructive" })
                    return
                  }
                  const token = typeof window !== "undefined" ? window.localStorage.getItem("auth_token") : null
                  if (!token) {
                    toast({ title: "Not signed in", description: "Please sign in to book a slot", variant: "destructive" })
                    return
                  }
                  const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
                  const payload = { slot_id: spot.id }
                  try {
                    const res = await fetch(`${API_BASE}/api/bookings/`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify(payload),
                    })
                    if (!res.ok) {
                      const text = await res.text()
                      toast({ title: "Booking failed", description: text || `status ${res.status}`, variant: "destructive" })
                      return
                    }
                    const data = await res.json()
                    toast({ title: "Booked", description: `Booking id: ${data.booking_id || ""}` })
                    // rely on SSE to update availability; optionally close popup
                    try {
                      // closing the currently open popup via the map is safer than calling
                      // closePopup on a possibly-removed marker (which may access internal
                      // _leaflet_pos and throw). Use map.closePopup() when available.
                      if (mapInstanceRef.current && typeof mapInstanceRef.current.closePopup === "function") {
                          // delay slightly to give Leaflet time to settle DOM references
                          setTimeout(() => {
                            try {
                              mapInstanceRef.current.closePopup()
                            } catch (err) {
                              console.warn("delayed closePopup failed", err)
                            }
                          }, 50)
                        }
                    } catch (err) {
                      console.warn("Failed to close popup safely", err)
                    }
                  } catch (err) {
                    console.error("booking error", err)
                    window.alert("Failed to book slot: network error")
                  }
                }
              } catch (err) {
                console.error("popup booking attach error", err)
              }
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

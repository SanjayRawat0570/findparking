"use client"

import { useEffect, useRef, useState } from "react"

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

interface AdminGoogleMapProps {
  center: { lat: number; lng: number }
  parkingSlots: ParkingSlot[]
  selectedSlot: string | null
  onSpotSelect: (id: string) => void
  onMapClick: (lat: number, lng: number, address?: string) => void
  isAddingMode: boolean
  newSlotLocation: { lat: number; lng: number } | null
}

function loadGoogleMaps(apiKey: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"))
    if ((window as any).google && (window as any).google.maps) return resolve()

    const existing = document.getElementById("gmaps-script")
    if (existing) {
      existing.addEventListener("load", () => resolve())
      return
    }

    const script = document.createElement("script")
    script.id = "gmaps-script"
    // include places library for autocomplete and geocoding
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = (e) => reject(e)
    document.head.appendChild(script)
  })
}

export default function AdminGoogleMap({
  center,
  parkingSlots,
  selectedSlot,
  onSpotSelect,
  onMapClick,
  isAddingMode,
  newSlotLocation,
}: AdminGoogleMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<{ [key: string]: any }>({})
  const newMarkerRef = useRef<any | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
    if (!apiKey) return
    let cancelled = false

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled) return
        const g = (window as any).google

        if (!mapInstanceRef.current && mapRef.current) {
          mapInstanceRef.current = new g.maps.Map(mapRef.current, {
            center: { lat: center.lat, lng: center.lng },
            zoom: 13,
          })

          // Add a search box (places autocomplete) on top-left of the map
          try {
            const input = document.createElement("input")
            input.type = "text"
            input.placeholder = "Search places or address"
            input.style.cssText = "box-sizing:border-box; border:1px solid #ccc; padding:8px; width:280px; margin:10px; border-radius:6px;"
            mapRef.current!.appendChild(input)

            const autocomplete = new g.maps.places.Autocomplete(input)
            autocomplete.bindTo("bounds", mapInstanceRef.current)
            autocomplete.addListener("place_changed", () => {
              const place = autocomplete.getPlace()
              if (place && place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat()
                const lng = place.geometry.location.lng()
                const address = place.formatted_address || ""
                mapInstanceRef.current!.panTo({ lat, lng })
                mapInstanceRef.current!.setZoom(15)
                // notify parent with the selected place and address
                onMapClick(lat, lng, address)
              }
            })
          } catch (e) {
            console.warn("Places Autocomplete not available", e)
          }

          // On map click, reverse geocode and pass address back when available
          mapInstanceRef.current.addListener("click", (e: any) => {
            if (isAddingMode) {
              const lat = e.latLng.lat()
              const lng = e.latLng.lng()
              // reverse geocode
              try {
                const geocoder = new g.maps.Geocoder()
                geocoder.geocode({ location: { lat, lng } }, (results: any) => {
                  const address = results && results[0] ? results[0].formatted_address : undefined
                  onMapClick(lat, lng, address)
                })
              } catch (err) {
                onMapClick(lat, lng)
              }
            }
          })
        }

        // mark ready after initializing map and controls
        setReady(true)
      })

    return () => {
      cancelled = true
      // don't remove global script; let other pages use it
    }
  }, [])

  useEffect(() => {
    if (!ready || !mapInstanceRef.current) return
    const map = mapInstanceRef.current

    // clear existing markers
    Object.values(markersRef.current).forEach((m) => m.setMap(null))
    markersRef.current = {}

    const g = (window as any).google
    parkingSlots.forEach((slot) => {
      const occupancy = slot.total - slot.available
      const color = occupancy > slot.total * 0.8 ? "#ef4444" : occupancy > slot.total * 0.5 ? "#eab308" : "#22c55e"
      const marker = new g.maps.Marker({
        position: { lat: slot.lat, lng: slot.lng },
        map,
        title: slot.name,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeWeight: 0,
          scale: 10,
        },
      })

      const info = new g.maps.InfoWindow({
        content: `<div style="min-width:220px"><h3 style="margin:0 0 8px 0">${slot.name}</h3><p style="margin:0 0 8px 0;color:#666">${slot.address}</p><div style="display:flex;gap:8px"><div><small style=\"color:#999\">Occupied</small><div style=\"font-weight:600\">${occupancy}/${slot.total}</div></div><div><small style=\"color:#999\">Price</small><div style=\"font-weight:600\">$${slot.price}/hr</div></div></div></div>`,
      })

      marker.addListener("click", () => {
        info.open(map, marker)
        if (!isAddingMode) onSpotSelect(slot.id)
      })

      markersRef.current[slot.id] = marker
    })

    // new slot marker
    if (newMarkerRef.current) {
      newMarkerRef.current.setMap(null)
      newMarkerRef.current = null
    }
    if (newSlotLocation) {
      newMarkerRef.current = new g.maps.Marker({
        position: { lat: newSlotLocation.lat, lng: newSlotLocation.lng },
        map,
        title: "New Slot",
        animation: g.maps.Animation.DROP,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          fillColor: "#3b82f6",
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "white",
          scale: 12,
        },
      })
    }

    if (selectedSlot && markersRef.current[selectedSlot]) {
      const m = markersRef.current[selectedSlot]
      if (m) {
        m.getMap()?.panTo(m.getPosition() as any)
        // open info window if needed — omitted for simplicity
      }
    }
  }, [ready, parkingSlots, newSlotLocation, selectedSlot, isAddingMode])

  return (
    <div className="h-full w-full">
      {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Google Maps API key not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.</div>
      ) : (
        <div ref={mapRef} className="h-full w-full" />
      )}
    </div>
  )
}

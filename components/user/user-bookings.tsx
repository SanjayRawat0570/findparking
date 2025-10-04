"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MapPin, Clock, Calendar, DollarSign } from "lucide-react"

// Mock bookings data
const mockBookings = [
  {
    id: "1",
    spotName: "Downtown Parking Plaza",
    address: "123 Main St, Downtown",
    date: "2025-03-15",
    startTime: "09:00 AM",
    endTime: "05:00 PM",
    duration: "8 hours",
    price: 40,
    status: "active",
  },
  {
    id: "2",
    spotName: "Mall Parking Lot",
    address: "789 Shopping Blvd, West Side",
    date: "2025-03-18",
    startTime: "02:00 PM",
    endTime: "06:00 PM",
    duration: "4 hours",
    price: 12,
    status: "upcoming",
  },
  {
    id: "3",
    spotName: "City Center Garage",
    address: "456 Center Ave, City Center",
    date: "2025-03-10",
    startTime: "10:00 AM",
    endTime: "02:00 PM",
    duration: "4 hours",
    price: 32,
    status: "completed",
  },
]

export function UserBookings() {
  const router = useRouter()

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500"
      case "upcoming":
        return "bg-blue-500"
      case "completed":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/user/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">My Bookings</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {mockBookings.map((booking) => (
            <Card key={booking.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg mb-1">{booking.spotName}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {booking.address}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Date:</span>
                      <span className="text-muted-foreground">{booking.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Time:</span>
                      <span className="text-muted-foreground">
                        {booking.startTime} - {booking.endTime}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Duration:</span>
                      <span className="text-muted-foreground">{booking.duration}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Total:</span>
                      <span className="text-muted-foreground">${booking.price}</span>
                    </div>
                  </div>
                </div>
                {booking.status === "active" && (
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" className="flex-1 bg-transparent">
                      View Details
                    </Button>
                    <Button variant="destructive" className="flex-1">
                      Cancel Booking
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}

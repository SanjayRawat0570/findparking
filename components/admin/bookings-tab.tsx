"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search } from "lucide-react"

const mockBookings = [
  {
    id: "BK001",
    user: "John Doe",
    email: "john@example.com",
    spot: "Downtown Plaza",
    date: "2025-03-15",
    time: "09:00 AM - 05:00 PM",
    amount: 40,
    status: "active",
  },
  {
    id: "BK002",
    user: "Jane Smith",
    email: "jane@example.com",
    spot: "City Center Garage",
    date: "2025-03-15",
    time: "10:00 AM - 02:00 PM",
    amount: 32,
    status: "active",
  },
  {
    id: "BK003",
    user: "Mike Johnson",
    email: "mike@example.com",
    spot: "Mall Parking",
    date: "2025-03-18",
    time: "02:00 PM - 06:00 PM",
    amount: 12,
    status: "upcoming",
  },
  {
    id: "BK004",
    user: "Sarah Williams",
    email: "sarah@example.com",
    spot: "Airport Long-Term",
    date: "2025-03-20",
    time: "08:00 AM - 08:00 PM",
    amount: 180,
    status: "upcoming",
  },
  {
    id: "BK005",
    user: "Tom Brown",
    email: "tom@example.com",
    spot: "Downtown Plaza",
    date: "2025-03-10",
    time: "01:00 PM - 05:00 PM",
    amount: 20,
    status: "completed",
  },
  {
    id: "BK006",
    user: "Emily Davis",
    email: "emily@example.com",
    spot: "Mall Parking",
    date: "2025-03-12",
    time: "11:00 AM - 03:00 PM",
    amount: 12,
    status: "completed",
  },
]

export function BookingsTab() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [filteredBookings, setFilteredBookings] = useState(mockBookings)

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    filterBookings(query, statusFilter)
  }

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    filterBookings(searchQuery, status)
  }

  const filterBookings = (query: string, status: string) => {
    let filtered = mockBookings

    if (query) {
      filtered = filtered.filter(
        (booking) =>
          booking.user.toLowerCase().includes(query.toLowerCase()) ||
          booking.email.toLowerCase().includes(query.toLowerCase()) ||
          booking.id.toLowerCase().includes(query.toLowerCase()) ||
          booking.spot.toLowerCase().includes(query.toLowerCase()),
      )
    }

    if (status !== "all") {
      filtered = filtered.filter((booking) => booking.status === status)
    }

    setFilteredBookings(filtered)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
      case "upcoming":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
      case "completed":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold">Bookings Management</h2>
        <p className="text-muted-foreground">Monitor and manage all parking reservations</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All Bookings</CardTitle>
              <CardDescription>View and search all parking reservations</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search bookings..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 w-[250px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No bookings found
                  </TableCell>
                </TableRow>
              ) : (
                filteredBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-mono font-medium">{booking.id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{booking.user}</p>
                        <p className="text-xs text-muted-foreground">{booking.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{booking.spot}</TableCell>
                    <TableCell>{booking.date}</TableCell>
                    <TableCell className="text-sm">{booking.time}</TableCell>
                    <TableCell className="font-medium">${booking.amount}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getStatusColor(booking.status)}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}

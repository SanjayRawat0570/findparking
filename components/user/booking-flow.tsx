"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, MapPin, Clock, DollarSign, CreditCard, CalendarIcon, Check } from "lucide-react"
import { format, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

// Mock parking spot data
const mockSpots: Record<string, any> = {
  "1": {
    id: "1",
    name: "Downtown Parking Plaza",
    address: "123 Main St, Downtown",
    price: 5,
    priceUnit: "hour",
    available: 12,
  },
  "2": {
    id: "2",
    name: "City Center Garage",
    address: "456 Center Ave, City Center",
    price: 8,
    priceUnit: "hour",
    available: 5,
  },
  "3": {
    id: "3",
    name: "Mall Parking Lot",
    address: "789 Shopping Blvd, West Side",
    price: 3,
    priceUnit: "hour",
    available: 45,
  },
  "4": {
    id: "4",
    name: "Airport Long-Term",
    address: "321 Airport Rd, Airport",
    price: 15,
    priceUnit: "day",
    available: 89,
  },
}

const timeSlots = [
  "12:00 AM",
  "01:00 AM",
  "02:00 AM",
  "03:00 AM",
  "04:00 AM",
  "05:00 AM",
  "06:00 AM",
  "07:00 AM",
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
  "06:00 PM",
  "07:00 PM",
  "08:00 PM",
  "09:00 PM",
  "10:00 PM",
  "11:00 PM",
]

interface BookingFlowProps {
  spotId: string
}

export function BookingFlow({ spotId }: BookingFlowProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [spot, setSpot] = useState<any | null>(null)
  const [loadingSpot, setLoadingSpot] = useState(true)
  const [bookingId, setBookingId] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoadingSpot(true)
      const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
      try {
        const res = await fetch(`${API_BASE}/api/slots/${encodeURIComponent(spotId)}`)
        if (!res.ok) {
          setSpot(null)
          setLoadingSpot(false)
          return
        }
        const data = await res.json()
        // normalize backend slot shape to the format used by this component
        const normalized = {
          id: data.id,
          name: data.name,
          address: data.address,
          price: data.price ?? 0,
          priceUnit: data.priceUnit ?? "hour",
          available: data.available ?? 0,
        }
        setSpot(normalized)
      } catch (err) {
        console.warn("Failed to fetch slot", err)
        setSpot(null)
      } finally {
        setLoadingSpot(false)
      }
    })()
  }, [spotId])

  const [step, setStep] = useState(1)
  const [date, setDate] = useState<Date>()
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [duration, setDuration] = useState(0)
  const [totalPrice, setTotalPrice] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState("card")
  const [cardNumber, setCardNumber] = useState("")
  const [cardName, setCardName] = useState("")
  const [cardExpiry, setCardExpiry] = useState("")
  const [cardCvv, setCardCvv] = useState("")
  const [processing, setProcessing] = useState(false)

  if (loadingSpot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading slot...</p>
      </div>
    )
  }

  if (!spot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p>Parking spot not found</p>
            <Button onClick={() => router.push("/user/dashboard")} className="mt-4">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const calculatePrice = (start: string, end: string) => {
    if (!start || !end) return 0
    const startIndex = timeSlots.indexOf(start)
    const endIndex = timeSlots.indexOf(end)
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return 0

    const hours = endIndex - startIndex
    setDuration(hours)
    return hours * spot.price
  }

  const handleTimeChange = (start: string, end: string) => {
    setStartTime(start)
    setEndTime(end)
    const price = calculatePrice(start, end)
    setTotalPrice(price)
  }

  const handleNextStep = () => {
    if (step === 1) {
      if (!date || !startTime || !endTime) {
        toast({
          title: "Missing information",
          description: "Please select date and time for your booking",
          variant: "destructive",
        })
        return
      }
    }
    setStep(step + 1)
  }

  const handleBooking = async () => {
    if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
      toast({
        title: "Missing payment details",
        description: "Please fill in all payment information",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 1200))

    // perform booking API call
    const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
    if (!token) {
      toast({ title: "Not signed in", description: "Please sign in to complete booking", variant: "destructive" })
      setProcessing(false)
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/bookings/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slot_id: spotId }),
      })
      if (!res.ok) {
        const txt = await res.text()
        toast({ title: "Booking failed", description: txt || `status ${res.status}`, variant: "destructive" })
        setProcessing(false)
        return
      }
      const body = await res.json()
      setBookingId(body.booking_id || null)
      toast({ title: "Booking confirmed!", description: `Booking id: ${body.booking_id || ""}` })
      setProcessing(false)
      setStep(3)
    } catch (err) {
      console.error("booking API error", err)
      toast({ title: "Booking failed", description: "Network error", variant: "destructive" })
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (step === 1 ? router.push("/user/dashboard") : setStep(step - 1))}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Book Parking</h1>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="border-b bg-muted/30">
        <div className="container px-4 py-4">
          <div className="flex items-center justify-center gap-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                  step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {step > 1 ? <Check className="h-4 w-4" /> : "1"}
              </div>
              <span className={cn("text-sm font-medium", step >= 1 ? "text-foreground" : "text-muted-foreground")}>
                Select Time
              </span>
            </div>
            <div className="h-px w-12 bg-border" />
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                  step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {step > 2 ? <Check className="h-4 w-4" /> : "2"}
              </div>
              <span className={cn("text-sm font-medium", step >= 2 ? "text-foreground" : "text-muted-foreground")}>
                Payment
              </span>
            </div>
            <div className="h-px w-12 bg-border" />
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                  step >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {step > 3 ? <Check className="h-4 w-4" /> : "3"}
              </div>
              <span className={cn("text-sm font-medium", step >= 3 ? "text-foreground" : "text-muted-foreground")}>
                Confirm
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Booking Form */}
            <div className="lg:col-span-2 space-y-6">
              {step === 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Select Date & Time</CardTitle>
                    <CardDescription>Choose when you need the parking spot</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Select Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !date && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            // disable past days (compare by day, not exact timestamp)
                            disabled={(d) => d < startOfDay(new Date())}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <Select value={startTime} onValueChange={(value) => handleTimeChange(value, endTime)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select start time" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <Select value={endTime} onValueChange={(value) => handleTimeChange(startTime, value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select end time" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {duration > 0 && (
                      <div className="rounded-lg bg-muted p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Duration</span>
                          <span className="text-sm text-muted-foreground">{duration} hours</span>
                        </div>
                      </div>
                    )}

                    <Button onClick={handleNextStep} className="w-full" size="lg">
                      Continue to Payment
                    </Button>
                  </CardContent>
                </Card>
              )}

              {step === 2 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Details</CardTitle>
                    <CardDescription>Enter your payment information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                        <div className="flex items-center space-x-2 rounded-lg border p-4">
                          <RadioGroupItem value="card" id="card" />
                          <Label htmlFor="card" className="flex-1 cursor-pointer font-normal">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              Credit / Debit Card
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <Input
                          id="cardNumber"
                          placeholder="1234 5678 9012 3456"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          maxLength={19}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cardName">Cardholder Name</Label>
                        <Input
                          id="cardName"
                          placeholder="John Doe"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="cardExpiry">Expiry Date</Label>
                          <Input
                            id="cardExpiry"
                            placeholder="MM/YY"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            maxLength={5}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cardCvv">CVV</Label>
                          <Input
                            id="cardCvv"
                            placeholder="123"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            maxLength={3}
                            type="password"
                          />
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleBooking} className="w-full" size="lg" disabled={processing}>
                      {processing ? "Processing..." : `Pay $${totalPrice}`}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {step === 3 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                      <div className="flex justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
                        <p className="text-muted-foreground">Your parking spot has been reserved successfully</p>
                      </div>

                      <div className="rounded-lg bg-muted p-4 text-left space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Booking ID</span>
                          <span className="font-mono font-medium">
                            #{Math.random().toString(36).substr(2, 9).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Date</span>
                          <span className="font-medium">{date ? format(date, "PPP") : ""}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Time</span>
                          <span className="font-medium">
                            {startTime} - {endTime}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Paid</span>
                          <span className="font-medium">${totalPrice}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 bg-transparent"
                          onClick={() => router.push("/user/bookings")}
                        >
                          View Bookings
                        </Button>
                        <Button className="flex-1" onClick={() => router.push("/user/dashboard")}>
                          Back to Dashboard
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Booking Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="text-lg">Booking Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-1">{spot.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {spot.address}
                    </p>
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    {date && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          Date
                        </span>
                        <span className="font-medium">{format(date, "MMM dd, yyyy")}</span>
                      </div>
                    )}

                    {startTime && endTime && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Time
                        </span>
                        <span className="font-medium">
                          {startTime} - {endTime}
                        </span>
                      </div>
                    )}

                    {duration > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="font-medium">{duration} hours</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Rate</span>
                      <span className="font-medium">
                        ${spot.price}/{spot.priceUnit}
                      </span>
                    </div>

                    {totalPrice > 0 && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-medium">${totalPrice}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Service Fee</span>
                          <span className="font-medium">$2</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="font-semibold flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Total
                          </span>
                          <span className="text-xl font-bold">${totalPrice + 2}</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

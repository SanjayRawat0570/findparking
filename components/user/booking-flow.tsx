"use client"

import { useState, useEffect, useRef } from "react"
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
  // Razorpay QR flow state
  const [processing, setProcessing] = useState(false)
  const [qrDataUri, setQrDataUri] = useState<string | null>(null)
  const [payUrl, setPayUrl] = useState<string | null>(null)
  const [linkId, setLinkId] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const pollRef = useRef<number | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)

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

  // Create Razorpay payment link and QR, then poll for payment status.
  const startPaymentLinkFlow = async () => {
    setProcessing(true)
    setPollError(null)
    const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "http://localhost:8080"
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
    if (!token) {
      toast({ title: "Not signed in", description: "Please sign in to complete booking", variant: "destructive" })
      setProcessing(false)
      return
    }

    // Amount: convert to paise (assume INR). Include service fee ($2 equivalent) in smallest unit.
    const amountPaise = Math.max(1, Math.round((totalPrice + 2) * 100))

    try {
      const res = await fetch(`${API_BASE}/api/payments/razorpay/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amountPaise, currency: "INR", description: `Booking for ${spot.name}` }),
      })
      if (!res.ok) {
        const txt = await res.text()
        toast({ title: "Payment setup failed", description: txt || `status ${res.status}`, variant: "destructive" })
        setProcessing(false)
        return
      }
      const body = await res.json()
      setLinkId(body.link_id || body.transaction_id || null)
      setQrDataUri(body.qr || body.qr_data_uri || null)
      setPayUrl(body.short_url || body.pay_url || null)

      // start polling
      setIsPolling(true)
      pollRef.current = window.setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/api/payments/razorpay/link/status?id=${encodeURIComponent(linkId || "")}`, { headers: { Authorization: `Bearer ${token}` } })
          if (!statusRes.ok) return
          const statusBody = await statusRes.json()
          if (statusBody.status === "succeeded") {
            // stop polling
            if (pollRef.current) {
              clearInterval(pollRef.current)
              pollRef.current = null
            }
            setIsPolling(false)
            // finalize booking
            const bookRes = await fetch(`${API_BASE}/api/bookings/`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ slot_id: spotId, transaction_id: linkId, paid: true }),
            })
            if (!bookRes.ok) {
              const txt = await bookRes.text()
              toast({ title: "Booking failed", description: txt || `status ${bookRes.status}`, variant: "destructive" })
              setProcessing(false)
              return
            }
            const bookBody = await bookRes.json()
            setBookingId(bookBody.booking_id || null)
            toast({ title: "Booking confirmed!", description: `Booking id: ${bookBody.booking_id || ""}` })
            setProcessing(false)
            setStep(3)
          }
        } catch (err) {
          console.warn("polling error", err)
          setPollError("Network error while polling payment status")
        }
      }, 2000)
    } catch (err) {
      console.error("payment link error", err)
      toast({ title: "Payment failed", description: "Could not create payment link", variant: "destructive" })
      setProcessing(false)
    }
  }

  const cancelPayment = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setIsPolling(false)
    setLinkId(null)
    setQrDataUri(null)
    setPayUrl(null)
    setProcessing(false)
    setStep(1)
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
                        <CardTitle>Payment (QR)</CardTitle>
                        <CardDescription>Scan the QR with your UPI/Razorpay app to pay</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="text-center">
                          {qrDataUri ? (
                            <div className="flex flex-col items-center gap-3">
                              <img src={qrDataUri} alt="payment qr" className="w-56 h-56 object-contain" />
                              <a href={payUrl || '#'} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                                Open payment link
                              </a>
                              <div className="text-sm text-muted-foreground">Waiting for payment confirmation...</div>
                              <div className="flex gap-2 mt-3">
                                <Button onClick={cancelPayment} variant="outline">Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-3">
                              <p className="text-sm">Preparing payment...</p>
                              <Button onClick={startPaymentLinkFlow} className="w-full" size="lg" disabled={processing}>
                                {processing ? "Preparing..." : `Generate QR & Pay $${totalPrice + 2}`}
                              </Button>
                            </div>
                          )}
                          {pollError && <div className="text-sm text-destructive mt-2">{pollError}</div>}
                        </div>
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

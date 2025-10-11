import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Find Parking - Smart Parking Management",
  description: "Find and book parking spots in real time",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <header className="w-full bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="font-bold">FindParking</div>
            <nav className="space-x-4">
              <a href="/" className="text-sm text-gray-700">Home</a>
              <a href="/ai" className="text-sm text-gray-700">AI Agent</a>
              <a href="/user/dashboard" className="text-sm text-gray-700">Dashboard</a>
            </nav>
          </div>
        </header>
        <main>
          <Suspense fallback={null}>
            {children}
            <Toaster />
          </Suspense>
        </main>
        <Analytics />
      </body>
    </html>
  )
}

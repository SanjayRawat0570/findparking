# Find Parking - Smart Parking Management System

A full-stack parking management application built with Next.js, featuring real-time slot booking, role-based authentication, and interactive map integration.

## Features

### User Features
- 🔐 Secure authentication with JWT
- 🗺️ Interactive map view to find nearby parking (Leaflet + OpenStreetMap)
- 🔍 Search parking spots by location and price
- 📅 Real-time booking system
- 💳 Integrated payment processing
- 📊 View booking history and active reservations
- 🧭 Navigation to parking locations

### Admin Features
- 📈 Revenue analytics and charts
- 🏢 Parking slot management (CRUD operations)
- 📋 Booking monitoring and management
- 📊 Occupancy rate tracking
- 💰 Financial reporting

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **UI**: Tailwind CSS v4, shadcn/ui components
- **Authentication**: JWT with role-based access control
- **Maps**: Leaflet + OpenStreetMap (100% Free, No API Key Required!)
- **Charts**: Recharts for analytics visualization

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

4. Open [http://localhost:3000](http://localhost:3000)

**No API keys or environment variables required!** The map integration uses free OpenStreetMap tiles.



## Project Structure

\`\`\`
├── app/
│   ├── auth/              # Authentication pages (login, signup)
│   ├── user/              # User dashboard and features
│   │   ├── dashboard/     # Main user dashboard
│   │   ├── booking/       # Booking flow
│   │   ├── bookings/      # Booking history
│   │   ├── map/           # Interactive map view
│   │   └── profile/       # User profile
│   └── admin/             # Admin dashboard and features
│       └── dashboard/     # Admin control panel
├── components/
│   ├── auth/              # Authentication components
│   ├── user/              # User-specific components
│   │   └── leaflet-map.tsx # Map component with Leaflet
│   └── admin/             # Admin-specific components
└── lib/
    └── auth.ts            # Authentication service
\`\`\`

## Features in Detail

### Authentication System
- Role-based access control (Admin/User)
- Protected routes with automatic redirection
- Persistent sessions with localStorage
- Logout functionality

### User Dashboard
- Search parking spots by location
- View real-time availability
- Quick stats overview
- Distance and pricing information
- Direct booking access

### Booking System
- Three-step booking flow
- Date and time selection
- Payment processing
- Booking confirmation
- Real-time price calculation

### Admin Dashboard
- Revenue and booking analytics
- Interactive charts (line and bar)
- Parking slot management
- Add/edit/delete parking locations
- Booking monitoring with filters
- Search functionality

### Map Integration (Free!)
- Interactive Leaflet map with OpenStreetMap tiles
- Color-coded parking markers (green/yellow/red for availability)
- User location marker
- Clickable markers with parking details
- Distance calculation
- Navigation to parking locations via Google Maps
- Real-time availability indicators
- **No API key required - completely free!**

## Why Leaflet + OpenStreetMap?

- ✅ **100% Free** - No API keys, no usage limits, no costs
- ✅ **Open Source** - Community-driven and transparent
- ✅ **No Restrictions** - Unlimited map loads and requests
- ✅ **Full Featured** - Markers, popups, custom styling, and more
- ✅ **Easy Integration** - Simple React implementation

## Environment Variables

No environment variables required! The application works out of the box.

## Future Enhancements

- Real backend API integration (Flask/MongoDB)
- Redis caching for availability
- Real-time updates with WebSockets
- Push notifications
- Payment gateway integration (Stripe)
- Mobile app version
- Advanced filtering options
- Parking spot reviews and ratings
- Route optimization for multiple stops

## License

MIT License
# findparking

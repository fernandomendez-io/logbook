# Logbook

A comprehensive flight logbook application for pilots to track flight hours, sequences, and compliance with FAR 117 regulations.

## Features

- **Flight Logging**: Record and manage flight details including aircraft, times, and routes
- **Sequence Management**: Track flight sequences and parse complex routing information
- **FAR 117 Compliance**: Monitor regulatory compliance and duty time limitations
- **Flight Tracking Integration**: Real-time flight data from multiple sources
  - FlightAware integration
- **Weather Data**: METAR parsing and weather information retrieval from Aviation Weather
- **Financial Tracking**: Calculate and manage flight pay based on various rates
- **User Management**: Admin panel for user and invitation management
- **Authentication**: Secure auth system with email verification
- **Flight Analysis Tools**:
  - Approach classifier for landing analysis
  - Night time calculations
  - ADS-B data from multiple providers (FlightRadar24, AeroDataBox)

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Authentication**: OAuth & Email-based auth
- **External APIs**: 
  - FlightAware
  - FlightRadar24
  - AeroDataBox
  - Aviation Weather

## Project Structure

```
app/                    # Next.js app directory
├── (admin)/            # Admin routes (protected)
├── (app)/              # Main app routes
│   ├── dashboard/
│   ├── flights/        # Flight management
│   ├── sequences/      # Flight sequence management
│   └── pay/            # Payment tracking
├── (auth)/             # Auth routes
├── api/                # API endpoints
components/             # React components
lib/                    # Utilities and helpers
├── api/                # External API integrations
├── aviation/           # Aviation calculations
├── parsers/            # Data parsers
└── supabase/          # Database client
public/                 # Static assets
supabase/              # Database migrations
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account and project

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables by creating a `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
# Add other API keys as needed
```

3. Run database migrations:
```bash
npx supabase migration up
```

4. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## API Routes

### Flights
- `GET/POST /api/flights` - List and create flights
- `GET/PUT /api/flights/[id]` - Get and update specific flight
- `GET /api/flights/[id]/acars` - Get ACARS data for flight

### Sequences
- `GET/POST /api/sequences` - Manage flight sequences
- `POST /api/sequences/parse` - Parse flight sequences

### Weather
- `GET /api/metar` - Get METAR data

### Analytics
- `GET /api/far117` - FAR 117 compliance data

### User Management
- `GET/POST /api/admin/users` - Manage users
- `GET/POST /api/admin/invitations` - Manage invitations

## Database Schema

The application uses Supabase with the following main tables:
- `users` - User profiles
- `flights` - Flight records
- `sequences` - Flight sequences
- `invitations` - User invitations
- And supporting tables for FAR 117 tracking

See `supabase/migrations/` for detailed schema definitions.

## Contributing

This is a personal project. For contributions or questions, please reach out.

## License

Proprietary - All rights reserved

# RideKeeper

**AI-powered transportation booking for homeless patients** - Reduce no-shows by automatically offering free Uber Health rides to high-risk patients.

Built for a 48-hour hackathon focused on homelessness solutions.

## The Problem

- **30% of homeless patients miss medical appointments** due to transportation barriers
- Transportation is the #1 barrier to healthcare access
- This costs **$150 billion annually** in missed appointments across the US
- Manual booking of rides is time-consuming and often too late

## The Solution

RideKeeper automatically:
1. **Predicts** which patients are at high risk of missing appointments (using housing status, distance, no-show history)
2. **Sends SMS offers** 24 hours before appointments: "Need a free ride? Reply YES"
3. **Books Uber Health rides** automatically when patients confirm
4. **Coordinates** with caseworkers for patients without phones

**Uber Health already shows 18:1 ROI** - RideKeeper makes it automatic.

## Features

- **Risk Scoring Algorithm** - Automatically calculates which patients need transportation help
- **SMS Automation** - Twilio integration for patient communication
- **AI-Powered Parsing** - Claude AI understands natural language responses ("yes please!", "no my friend is taking me")
- **Mock Uber Health API** - Realistic ride booking simulation
- **Real-time Dashboard** - Live updates via WebSocket
- **Demo Mode** - Perfect for presentations with simulated responses

## Tech Stack

### Frontend
- React 18 + Vite
- TypeScript
- Tailwind CSS + shadcn/ui
- React Query + Zustand
- Socket.io client

### Backend
- Node.js + Express
- TypeScript
- PostgreSQL + Prisma ORM
- Socket.io
- node-cron for scheduling

### Integrations
- **Twilio** - SMS messaging
- **Claude AI** - Natural language parsing
- **Uber Health** - Mocked for demo (would use real API in production)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Twilio account (for SMS)
- Anthropic API key (for Claude AI)

### Installation

1. **Clone and install dependencies**

```bash
cd ridekeeper

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

2. **Set up environment variables**

```bash
# In backend directory
cp .env.example .env
```

Edit `.env` with your values:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/ridekeeper"
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
ANTHROPIC_API_KEY=your_api_key
```

3. **Set up the database**

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:push

# Seed demo data
npm run db:seed
```

4. **Start the servers**

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

5. **Open the app**

Visit `http://localhost:5173` in your browser.

## Demo Mode

The app starts in Demo Mode by default, perfect for presentations:

### Keyboard Shortcuts
- `D` - Toggle demo mode
- `P` - Presentation mode (full screen, hides sidebar)
- `Escape` - Close celebration modal

### Demo Features
- **"Simulate YES" buttons** - Auto-reply to ride offers
- **Fast-forward controls** - Skip to pickup, ride in progress, or completed
- **Reset Demo** - Return to initial state
- **Celebration animation** - Confetti when patient attends appointment

## Project Structure

```
ridekeeper/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── lib/             # Utilities and API client
│   │   ├── stores/          # Zustand state stores
│   │   └── hooks/           # Custom React hooks
│   └── ...
│
├── backend/                  # Express API server
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic services
│   │   └── index.ts         # Server entry point
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.ts          # Demo data seeder
│   └── ...
│
└── shared/                   # Shared TypeScript types
    └── types.ts
```

## API Endpoints

### Appointments
- `GET /api/appointments/upcoming` - Get upcoming appointments
- `GET /api/appointments/:id` - Get appointment details
- `POST /api/appointments/:id/calculate-risk` - Calculate risk score
- `POST /api/appointments/:id/offer-ride` - Send SMS ride offer
- `POST /api/appointments/:id/manual-confirm` - Coordinator confirmation

### Rides
- `POST /api/rides/book` - Book Uber Health ride
- `GET /api/rides/:id` - Get ride details
- `POST /api/rides/:id/cancel` - Cancel ride

### SMS
- `POST /api/sms/webhook` - Twilio incoming SMS webhook
- `GET /api/sms/messages` - Get message history
- `POST /api/sms/simulate-reply` - Demo: simulate patient reply

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `POST /api/dashboard/demo/reset` - Reset demo data
- `POST /api/dashboard/demo/fast-forward` - Fast-forward ride status

## Risk Scoring Algorithm

| Factor | Points |
|--------|--------|
| Homeless | +40 |
| Unstably Housed | +25 |
| Distance > 5 miles | +30 |
| Distance 2-5 miles | +20 |
| No phone access | +25 |
| Each previous no-show | +15 (max +60) |

**Risk Categories:**
- 0-30: Low Risk (green)
- 31-60: Medium Risk (yellow)
- 61-100: High Risk (red)

## Seed Data

The demo includes 5 patients with varying risk levels:

| Patient | Risk Score | Notes |
|---------|------------|-------|
| Maria Rodriguez | 85 (HIGH) | Homeless, 4.2 miles, 2 no-shows |
| James Wilson | 95 (HIGH) | Homeless, no phone, uses caseworker |
| Carlos Martinez | 50 (MEDIUM) | Unstably housed, declined ride |
| Lisa Chen | 100 (HIGH) | Homeless, 3 no-shows |
| David Kim | 10 (LOW) | Housed, 0.8 miles |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   React App     │────▶│  Express API    │────▶│   PostgreSQL    │
│   (Dashboard)   │     │  (+ Socket.io)  │     │   Database      │
│                 │◀────│                 │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │
         │                      ├──────▶ Twilio (SMS)
         │                      │
         │                      ├──────▶ Claude AI (NLP)
         │                      │
         └──────────────────────┴──────▶ Uber Health (Mocked)
```

## Future Improvements

- [ ] Google Maps integration for real distance calculations
- [ ] Real Uber Health API integration (requires healthcare provider credentials)
- [ ] Patient mobile app for ride tracking
- [ ] Multi-language SMS support
- [ ] Integration with EMR systems
- [ ] Analytics dashboard with ROI tracking

## License

MIT

## Team

Built with care for a 48-hour hackathon to help solve homelessness challenges.

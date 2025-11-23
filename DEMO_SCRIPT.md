# RideKeeper Demo Script

## Quick Setup (5 minutes before demo)

```bash
# Terminal 1 - Start backend
cd backend
npm run db:reset  # Reset to clean state
npm run dev

# Terminal 2 - Start frontend
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Demo Flow (5-7 minutes)

### Opening Hook (30 seconds)

> "Thirty percent of homeless patients miss their medical appointments - not because they don't want to go, but because they can't get there. Transportation is the number one barrier to healthcare access, and it costs $150 billion annually in missed appointments. RideKeeper solves this."

### The Problem (30 seconds)

> "Here's the typical scenario: A homeless patient named Maria has a diabetes follow-up tomorrow. She's staying at a shelter 4 miles from the clinic with no reliable transportation. A coordinator might not realize she needs help until she's already a no-show. By then, it's too late."

### Show the Dashboard (1 minute)

1. Point to the **stat cards** at the top:
   - "We have 5 upcoming appointments this week"
   - "3 are high-risk patients" (point to red indicator)
   - "And historically, 30% end up as no-shows"

2. Show the **appointments table**:
   - "Notice Maria Rodriguez here - risk score of 85, flagged as HIGH"
   - "The system calculated this based on her housing status, distance from clinic, and history of missed appointments"

### Risk Score Breakdown (1 minute)

1. Click on **Maria Rodriguez** to open detail view
2. Show the **Risk Score Breakdown** card:
   - "She's homeless - that's 40 points"
   - "She's 4.2 miles from the clinic - 20 points"
   - "She has 2 previous no-shows - 30 points"
   - "Total: 90 points, definitely high risk"

### Send a Ride Offer (1 minute)

1. Click **"Send Ride Offer"** button
2. Show the toast notification: "SMS sent to Maria"
3. Scroll down to **Communication** section:
   - "Maria just received this text: 'Hi Maria! You have an appointment tomorrow at 10 AM. Need a free ride? Reply YES'"

### Simulate Patient Response (1 minute)

1. Click **"Simulate YES"** button (demo mode)
2. Watch the magic happen:
   - Toast: "Reply simulated - Maria replied YES"
   - Ride automatically booked!
   - Show the new **Ride Information** card:
     - Status: Scheduled
     - Pickup time: 9:15 AM
     - Estimated cost: $18

> "When Maria texts YES, our Claude AI parses her response - even if she says 'yes please!' or 'yeah sounds good' - and automatically books an Uber Health ride."

### Fast Forward Demo (30 seconds)

1. Click **"Driver Arriving"** button
   - Show status change and driver info appears
2. Click **"Complete"** button
   - **CONFETTI ANIMATION!**
   - Show celebration modal: "Maria attended her appointment!"
   - Show ROI: "$150 saved"

> "Maria made it to her appointment. One $18 ride saved $150+ in missed appointment costs. That's the 18:1 ROI that Uber Health has proven."

### Edge Case: No Phone (30 seconds)

1. Go back to dashboard, find **James Wilson**
2. Point out: "Notice he has NO PHONE on file"
3. Click into detail:
   - Show caseworker info: "Sarah Johnson, Downtown Shelter"
   - "When we send a ride offer for James, it goes to his caseworker instead"
   - "The caseworker can confirm he'll be ready for pickup"

### Key Talking Points

Use these stats throughout:

- **30%** of homeless patients miss appointments due to transportation
- **$150 billion** annual cost of missed appointments in the US
- **18:1 ROI** proven by Uber Health for transportation assistance
- **24 hours** before appointment - automatic outreach
- **AI-powered** - understands natural language responses

### Closing (30 seconds)

> "RideKeeper transforms Uber Health from a manual process into an automated system. Instead of coordinators racing to book rides after patients miss appointments, we predict who needs help and offer it proactively. The patient just texts YES, and they make it to their appointment."

---

## Backup Plans

### If Backend Won't Start
- Check PostgreSQL is running
- Run `npm run db:push` to create tables

### If Database Is Empty
- Run `npm run db:seed` in backend folder

### If SMS Shows "No Phone Available"
- That patient has no phone - this is intentional for the caseworker demo
- Show how it routes to caseworker instead

### If Demo Mode Toggle Is Off
- Press `D` to enable demo mode
- This enables the "Simulate YES" and fast-forward buttons

---

## Keyboard Shortcuts Reference

| Key | Action |
|-----|--------|
| `D` | Toggle demo mode |
| `P` | Presentation mode (full screen) |
| `Escape` | Close celebration modal |

---

## Q&A Preparation

**Q: How do you calculate the risk score?**
> Housing status (0-40), distance (10-30), phone access (0-25), and no-show history (up to 60) combine to create a 0-100 score.

**Q: What if the patient says something unclear?**
> Our Claude AI parses natural language. "yeah pick me up at civic center instead" would be understood as YES with an alternative pickup location.

**Q: Does this integrate with real EMRs?**
> This demo uses mock data, but the architecture is designed to pull appointments from any healthcare system via API.

**Q: What's the cost per ride?**
> Average $15-25 per ride. With 18:1 ROI from prevented no-shows, the economics are very favorable.

**Q: What if the patient doesn't respond?**
> After 4 hours with no response, a coordinator is alerted to follow up manually. We don't spam patients.

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

import { createAppointmentRoutes } from './routes/appointments.routes.js';
import { createRideRoutes } from './routes/rides.routes.js';
import { createSMSRoutes } from './routes/sms.routes.js';
import { createDashboardRoutes } from './routes/dashboard.routes.js';
import { SchedulerService } from './services/scheduler.service.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For Twilio webhook

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/appointments', createAppointmentRoutes(prisma, io));
app.use('/api/rides', createRideRoutes(prisma, io));
app.use('/api/sms', createSMSRoutes(prisma, io));
app.use('/api/dashboard', createDashboardRoutes(prisma, io));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  // Allow clients to join specific appointment rooms
  socket.on('join-appointment', (appointmentId: string) => {
    socket.join(`appointment:${appointmentId}`);
    console.log(`Client ${socket.id} joined appointment:${appointmentId}`);
  });

  socket.on('leave-appointment', (appointmentId: string) => {
    socket.leave(`appointment:${appointmentId}`);
  });
});

// Initialize scheduler
const scheduler = new SchedulerService(prisma);
scheduler.setSocketIO(io);

// Start scheduler in production (skip in dev for manual testing)
if (process.env.NODE_ENV === 'production') {
  scheduler.startAllJobs();
}

// Manual scheduler triggers (for development/demo)
app.post('/api/scheduler/trigger/:job', async (req, res) => {
  const { job } = req.params;

  try {
    switch (job) {
      case 'risk-scores':
        await scheduler.triggerRiskCalculation();
        break;
      case 'ride-offers':
        await scheduler.triggerRideOffers();
        break;
      case 'reminders':
        await scheduler.triggerReminders();
        break;
      case 'status-updates':
        await scheduler.triggerStatusUpdates();
        break;
      default:
        return res.status(400).json({ error: 'Unknown job' });
    }

    res.json({ success: true, job, triggeredAt: new Date() });
  } catch (error) {
    console.error(`Error triggering ${job}:`, error);
    res.status(500).json({ error: 'Failed to trigger job' });
  }
});

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚗 RideKeeper Backend Server                            ║
║                                                           ║
║   Server running on port ${PORT}                            ║
║   Health check: http://localhost:${PORT}/health              ║
║                                                           ║
║   WebSocket: ws://localhost:${PORT}                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  scheduler.stopAllJobs();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  scheduler.stopAllJobs();
  await prisma.$disconnect();
  process.exit(0);
});

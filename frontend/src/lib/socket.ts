import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // Forward all events to registered listeners
    const events = [
      'SMS_RECEIVED',
      'RIDE_BOOKED',
      'RIDE_STATUS_UPDATE',
      'RIDE_OFFER_SENT',
      'RIDE_REMINDER_SENT',
      'RISK_SCORE_CALCULATED',
      'APPOINTMENT_UPDATE',
      'APPOINTMENT_COMPLETED',
      'DEMO_RESET',
      'DEMO_FAST_FORWARD',
    ];

    events.forEach((event) => {
      this.socket?.on(event, (data: unknown) => {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
          eventListeners.forEach((callback) => callback(data));
        }
      });
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  subscribe(event: string, callback: (data: unknown) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  joinAppointment(appointmentId: string) {
    this.socket?.emit('join-appointment', appointmentId);
  }

  leaveAppointment(appointmentId: string) {
    this.socket?.emit('leave-appointment', appointmentId);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();

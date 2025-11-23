import { v4 as uuidv4 } from 'uuid';

export interface UberLocation {
  address: string;
  lat: number;
  lng: number;
}

export interface UberRideRequest {
  pickupLocation: UberLocation;
  dropoffLocation: UberLocation;
  pickupTime: Date;
  patientName: string;
  patientPhone: string;
}

export interface UberDriver {
  name: string;
  vehicle: string;
  license: string;
  phone?: string;
}

export interface UberRideResponse {
  ride_id: string;
  status: 'scheduled' | 'driver_assigned' | 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  pickup_time: string;
  pickup_location: { lat: number; lng: number; address: string };
  dropoff_location: { lat: number; lng: number; address: string };
  driver: UberDriver | null;
  estimated_cost: number;
  eta_minutes?: number;
  current_location?: { lat: number; lng: number };
}

// Mock driver names and vehicles for realistic demo
const MOCK_DRIVERS: UberDriver[] = [
  { name: 'Sarah M.', vehicle: 'Gray Honda Civic', license: '7ABC123' },
  { name: 'Michael R.', vehicle: 'White Toyota Camry', license: '8XYZ789' },
  { name: 'Jennifer L.', vehicle: 'Blue Hyundai Elantra', license: '5DEF456' },
  { name: 'David K.', vehicle: 'Black Nissan Altima', license: '3GHI321' },
  { name: 'Maria G.', vehicle: 'Silver Honda Accord', license: '9JKL654' }
];

// In-memory store for mock rides (for demo purposes)
const mockRides = new Map<string, UberRideResponse>();

export class UberHealthService {
  private baseRate = 8; // Base $8
  private perMileRate = 2.5; // $2.50 per mile

  constructor() {
    // Initialize the service
  }

  /**
   * Book a ride through Uber Health (MOCKED)
   * Simulates a 500ms API delay and returns realistic mock data
   */
  async bookRide(request: UberRideRequest): Promise<UberRideResponse> {
    // Simulate API delay
    await this.delay(500);

    const rideId = `UBER_${uuidv4().substring(0, 8).toUpperCase()}`;

    // Calculate distance between pickup and dropoff (simplified)
    const distance = this.calculateDistance(
      request.pickupLocation.lat,
      request.pickupLocation.lng,
      request.dropoffLocation.lat,
      request.dropoffLocation.lng
    );

    // Calculate estimated cost: Base $8 + $2.50/mile
    const estimatedCost = Math.round(this.baseRate + (distance * this.perMileRate));

    const ride: UberRideResponse = {
      ride_id: rideId,
      status: 'scheduled',
      pickup_time: request.pickupTime.toISOString(),
      pickup_location: {
        lat: request.pickupLocation.lat,
        lng: request.pickupLocation.lng,
        address: request.pickupLocation.address
      },
      dropoff_location: {
        lat: request.dropoffLocation.lat,
        lng: request.dropoffLocation.lng,
        address: request.dropoffLocation.address
      },
      driver: null, // Driver assigned closer to pickup time
      estimated_cost: estimatedCost
    };

    // Store in mock database
    mockRides.set(rideId, ride);

    return ride;
  }

  /**
   * Get ride status (MOCKED)
   * Returns status progression based on time until pickup
   */
  async getRideStatus(rideId: string): Promise<UberRideResponse | null> {
    await this.delay(200);

    const ride = mockRides.get(rideId);
    if (!ride) return null;

    const pickupTime = new Date(ride.pickup_time);
    const now = new Date();
    const minutesUntilPickup = (pickupTime.getTime() - now.getTime()) / (1000 * 60);

    // Update status based on time
    let updatedRide = { ...ride };

    if (minutesUntilPickup <= 0) {
      // Past pickup time
      if (ride.status !== 'completed' && ride.status !== 'cancelled') {
        updatedRide.status = 'in_progress';

        // After 30 minutes, mark as completed
        if (minutesUntilPickup <= -30) {
          updatedRide.status = 'completed';
        }
      }
    } else if (minutesUntilPickup <= 5) {
      // Driver has arrived
      updatedRide.status = 'arrived';
      if (!updatedRide.driver) {
        updatedRide.driver = this.getRandomDriver();
      }
    } else if (minutesUntilPickup <= 15) {
      // Driver en route
      updatedRide.status = 'en_route';
      if (!updatedRide.driver) {
        updatedRide.driver = this.getRandomDriver();
      }
      updatedRide.eta_minutes = Math.round(minutesUntilPickup);
      updatedRide.current_location = this.interpolateLocation(
        ride.dropoff_location,
        ride.pickup_location,
        minutesUntilPickup / 15
      );
    } else if (minutesUntilPickup <= 60) {
      // Driver assigned within 1 hour of pickup
      updatedRide.status = 'driver_assigned';
      if (!updatedRide.driver) {
        updatedRide.driver = this.getRandomDriver();
      }
    }

    // Update stored ride
    mockRides.set(rideId, updatedRide);

    return updatedRide;
  }

  /**
   * Cancel a ride (MOCKED)
   */
  async cancelRide(rideId: string): Promise<{ success: boolean; message: string }> {
    await this.delay(300);

    const ride = mockRides.get(rideId);
    if (!ride) {
      return { success: false, message: 'Ride not found' };
    }

    if (ride.status === 'completed') {
      return { success: false, message: 'Cannot cancel completed ride' };
    }

    if (ride.status === 'in_progress') {
      return { success: false, message: 'Cannot cancel ride in progress' };
    }

    ride.status = 'cancelled';
    mockRides.set(rideId, ride);

    return { success: true, message: 'Ride cancelled successfully' };
  }

  /**
   * Update ride location (for demo purposes)
   * Returns mock GPS coordinates showing driver approaching
   */
  async updateRideLocation(rideId: string): Promise<{ lat: number; lng: number } | null> {
    const ride = mockRides.get(rideId);
    if (!ride || !ride.current_location) return null;

    // Move driver closer to pickup
    const pickup = ride.pickup_location;
    const current = ride.current_location;

    const newLat = current.lat + (pickup.lat - current.lat) * 0.1;
    const newLng = current.lng + (pickup.lng - current.lng) * 0.1;

    ride.current_location = { lat: newLat, lng: newLng };
    mockRides.set(rideId, ride);

    return ride.current_location;
  }

  /**
   * Force a ride status update (for demo fast-forward)
   */
  async forceStatusUpdate(rideId: string, status: UberRideResponse['status']): Promise<UberRideResponse | null> {
    const ride = mockRides.get(rideId);
    if (!ride) return null;

    ride.status = status;

    if (status === 'driver_assigned' && !ride.driver) {
      ride.driver = this.getRandomDriver();
    }

    if (status === 'en_route') {
      ride.eta_minutes = 5;
      ride.current_location = this.interpolateLocation(
        ride.dropoff_location,
        ride.pickup_location,
        0.5
      );
    }

    if (status === 'arrived') {
      ride.current_location = ride.pickup_location;
      ride.eta_minutes = 0;
    }

    mockRides.set(rideId, ride);
    return ride;
  }

  /**
   * Get all mock rides (for demo dashboard)
   */
  getAllRides(): UberRideResponse[] {
    return Array.from(mockRides.values());
  }

  /**
   * Clear all mock rides (for demo reset)
   */
  clearAllRides(): void {
    mockRides.clear();
  }

  // Helper methods

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getRandomDriver(): UberDriver {
    return MOCK_DRIVERS[Math.floor(Math.random() * MOCK_DRIVERS.length)];
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Haversine formula for distance calculation
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private interpolateLocation(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    progress: number
  ): { lat: number; lng: number } {
    return {
      lat: from.lat + (to.lat - from.lat) * progress,
      lng: from.lng + (to.lng - from.lng) * progress
    };
  }

  /**
   * Calculate estimated cost for a ride
   */
  calculateEstimatedCost(distanceMiles: number): number {
    return Math.round(this.baseRate + (distanceMiles * this.perMileRate));
  }
}

// Singleton instance
export const uberHealthService = new UberHealthService();

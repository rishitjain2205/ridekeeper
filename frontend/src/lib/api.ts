const API_BASE = '/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
    action?: string;
  };
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Failed to connect to server',
      },
    };
  }
}

// Appointments
export const appointmentsApi = {
  getUpcoming: (filters?: { riskFilter?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.riskFilter) params.set('riskFilter', filters.riskFilter);
    if (filters?.status) params.set('status', filters.status);
    return fetchApi<unknown[]>(`/appointments/upcoming?${params}`);
  },

  getToday: () => fetchApi<unknown[]>('/appointments/today'),

  getById: (id: string, includeAI: boolean = false) =>
    fetchApi<unknown>(`/appointments/${id}?includeAI=${includeAI}`),

  calculateRisk: (id: string, useAI: boolean = true) =>
    fetchApi<unknown>(`/appointments/${id}/calculate-risk`, {
      method: 'POST',
      body: JSON.stringify({ useAI })
    }),

  calculateAIRisk: (id: string) =>
    fetchApi<unknown>(`/appointments/${id}/calculate-ai-risk`, { method: 'POST' }),

  getAIStatus: (id: string) =>
    fetchApi<{
      hasAIScore: boolean;
      aiScore: number | null;
      baseScore: number | null;
      confidence: number | null;
      reasoning: string | null;
      recommendations: string[];
      aiAvailable: boolean;
    }>(`/appointments/${id}/ai-status`),

  offerRide: (id: string) =>
    fetchApi<unknown>(`/appointments/${id}/offer-ride`, { method: 'POST' }),

  manualConfirm: (id: string) =>
    fetchApi<unknown>(`/appointments/${id}/manual-confirm`, { method: 'POST' }),

  markCompleted: (id: string) =>
    fetchApi<unknown>(`/appointments/${id}/mark-completed`, { method: 'POST' }),

  markNoShow: (id: string) =>
    fetchApi<unknown>(`/appointments/${id}/mark-noshow`, { method: 'POST' }),
};

// Rides
export const ridesApi = {
  getToday: () => fetchApi<unknown[]>('/rides'),

  getById: (id: string) => fetchApi<unknown>(`/rides/${id}`),

  book: (data: { appointmentId: string; pickupLocation: string; pickupTime: string }) =>
    fetchApi<unknown>('/rides/book', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancel: (id: string) =>
    fetchApi<unknown>(`/rides/${id}/cancel`, { method: 'POST' }),

  updateStatus: (id: string, status: string) =>
    fetchApi<unknown>(`/rides/${id}/update-status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
};

// SMS
export const smsApi = {
  getMessages: (filters?: { appointmentId?: string; phoneNumber?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.appointmentId) params.set('appointmentId', filters.appointmentId);
    if (filters?.phoneNumber) params.set('phoneNumber', filters.phoneNumber);
    if (filters?.limit) params.set('limit', String(filters.limit));
    return fetchApi<unknown[]>(`/sms/messages?${params}`);
  },

  send: (data: { phoneNumber: string; message: string; appointmentId?: string }) =>
    fetchApi<unknown>('/sms/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  simulateReply: (appointmentId: string, message: string = 'YES') =>
    fetchApi<unknown>('/sms/simulate-reply', {
      method: 'POST',
      body: JSON.stringify({ appointmentId, message }),
    }),
};

// Dashboard
export const dashboardApi = {
  getStats: () =>
    fetchApi<{
      upcomingAppointments: number;
      highRiskPatients: number;
      ridesScheduledToday: number;
      noShowRate: number;
      noShowTrend: number;
    }>('/dashboard/stats'),

  getRidesSummary: () =>
    fetchApi<{
      scheduled: number;
      driverAssigned: number;
      inProgress: number;
      completed: number;
      cancelled: number;
    }>('/dashboard/rides-summary'),

  getRoi: () =>
    fetchApi<{
      completedRides: number;
      appointmentsAttended: number;
      totalRideCost: number;
      avgRideCost: number;
      preventedNoShowValue: number;
      netSavings: number;
      roi: number;
    }>('/dashboard/roi'),

  resetDemo: () =>
    fetchApi<{ message: string }>('/dashboard/demo/reset', { method: 'POST' }),

  fastForward: (appointmentId: string, targetState: string) =>
    fetchApi<unknown>('/dashboard/demo/fast-forward', {
      method: 'POST',
      body: JSON.stringify({ appointmentId, targetState }),
    }),
};

// Scheduler triggers
export const schedulerApi = {
  triggerRiskScores: () =>
    fetchApi<unknown>('/scheduler/trigger/risk-scores', { method: 'POST' }),

  triggerRideOffers: () =>
    fetchApi<unknown>('/scheduler/trigger/ride-offers', { method: 'POST' }),

  triggerReminders: () =>
    fetchApi<unknown>('/scheduler/trigger/reminders', { method: 'POST' }),

  triggerStatusUpdates: () =>
    fetchApi<unknown>('/scheduler/trigger/status-updates', { method: 'POST' }),
};

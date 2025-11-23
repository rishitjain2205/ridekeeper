import { create } from 'zustand';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: 'default' | 'success' | 'warning' | 'error';
}

interface AppState {
  // Demo mode
  demoMode: boolean;
  presentationMode: boolean;
  toggleDemoMode: () => void;
  togglePresentationMode: () => void;

  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Celebration state
  showCelebration: boolean;
  celebrationMessage: string;
  triggerCelebration: (message: string) => void;
  hideCelebration: () => void;

  // Selected appointment for detail view
  selectedAppointmentId: string | null;
  setSelectedAppointmentId: (id: string | null) => void;

  // Filters
  riskFilter: 'all' | 'high' | 'medium' | 'low';
  setRiskFilter: (filter: 'all' | 'high' | 'medium' | 'low') => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Demo mode
  demoMode: true, // Start in demo mode for hackathon
  presentationMode: false,
  toggleDemoMode: () => set((state) => ({ demoMode: !state.demoMode })),
  togglePresentationMode: () => set((state) => ({ presentationMode: !state.presentationMode })),

  // Toasts
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 5000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Celebration
  showCelebration: false,
  celebrationMessage: '',
  triggerCelebration: (message) =>
    set({ showCelebration: true, celebrationMessage: message }),
  hideCelebration: () => set({ showCelebration: false, celebrationMessage: '' }),

  // Selected appointment
  selectedAppointmentId: null,
  setSelectedAppointmentId: (id) => set({ selectedAppointmentId: id }),

  // Filters
  riskFilter: 'all',
  setRiskFilter: (filter) => set({ riskFilter: filter }),
}));

// Keyboard shortcuts
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    // Only trigger if not in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const store = useAppStore.getState();

    switch (e.key.toLowerCase()) {
      case 'd':
        store.toggleDemoMode();
        break;
      case 'p':
        store.togglePresentationMode();
        break;
      case 'escape':
        if (store.showCelebration) {
          store.hideCelebration();
        }
        break;
    }
  });
}

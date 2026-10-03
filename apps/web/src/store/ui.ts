import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  onboardingCompleted: boolean;
  demoMode: boolean;
  sidebarOpen: boolean;
  completeOnboarding: () => void;
  setDemoMode: (value: boolean) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      demoMode: false,
      sidebarOpen: true,
      completeOnboarding: () => set({ onboardingCompleted: true }),
      setDemoMode: (value) => set({ demoMode: value }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    { name: 'pvm.ui' },
  ),
);

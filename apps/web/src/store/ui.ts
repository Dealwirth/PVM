import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  onboardingCompleted: boolean;
  demoMode: boolean;
  sidebarOpen: boolean;
  mobileNavOpen: boolean;
  completeOnboarding: () => void;
  setDemoMode: (value: boolean) => void;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      demoMode: false,
      sidebarOpen: true,
      mobileNavOpen: false,
      completeOnboarding: () => set({ onboardingCompleted: true }),
      setDemoMode: (value) => set({ demoMode: value }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setMobileNav: (open) => set({ mobileNavOpen: open }),
    }),
    {
      name: 'pvm.ui',
      // Only persist durable preferences; the drawer must start closed on load.
      partialize: (s) => ({
        onboardingCompleted: s.onboardingCompleted,
        demoMode: s.demoMode,
        sidebarOpen: s.sidebarOpen,
      }),
    },
  ),
);

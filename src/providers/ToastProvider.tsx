// src/providers/ToastProvider.tsx
// Global toast notification provider
//
// Provides showToast() function via context for displaying toast messages
// anywhere in the app. Renders the Toast component at the root level.

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Toast, ToastVariant } from "@/components/Toast";

// =============================================================================
// TYPES
// =============================================================================

interface ToastState {
  visible: boolean;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  showToast: (
    message: string,
    variant?: ToastVariant,
    duration?: number,
  ) => void;
  hideToast: () => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    variant: "info",
    duration: 4000,
  });

  const showToast = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      duration: number = 4000,
    ) => {
      setToast({
        visible: true,
        message,
        variant,
        duration,
      });
    },
    [],
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      hideToast,
    }),
    [showToast, hideToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={hideToast}
        duration={toast.duration}
      />
    </ToastContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

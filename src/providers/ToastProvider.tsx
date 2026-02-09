// src/providers/ToastProvider.tsx
// Global toast notification provider
//
// Provides showToast() function via context for displaying toast messages
// anywhere in the app. Renders the Toast component at the root level.
//
// API: showToast(message, options?)
//   options.variant     - "info" | "warning" | "error" | "success" (default: "info")
//   options.duration    - auto-dismiss ms, 0 = sticky (default: 4000)
//   options.actionLabel - optional action button text
//   options.onAction    - optional action button callback
//
// NOTE: onAction is stored in a ref, not state — closures must never be
// serialized into React state. This also prevents silent overwrite if a
// second showToast fires while an action toast is still visible.

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { Toast, ToastVariant } from "@/components/Toast";

// =============================================================================
// TYPES
// =============================================================================

export interface ToastOptions {
  variant?: ToastVariant;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastState {
  visible: boolean;
  message: string;
  variant: ToastVariant;
  duration: number;
  actionLabel?: string;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
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

  // Callback stored in ref — never in state.
  // Refs hold references; state serializes values.
  const onActionRef = useRef<(() => void) | undefined>(undefined);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    onActionRef.current = options?.onAction;
    setToast({
      visible: true,
      message,
      variant: options?.variant ?? "info",
      duration: options?.duration ?? 4000,
      actionLabel: options?.actionLabel,
    });
  }, []);

  const hideToast = useCallback(() => {
    onActionRef.current = undefined;
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleAction = useCallback(() => {
    onActionRef.current?.();
    // Don't clear ref here — hideToast will clear it
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
        actionLabel={toast.actionLabel}
        onAction={toast.actionLabel ? handleAction : undefined}
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

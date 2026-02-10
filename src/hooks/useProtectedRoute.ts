// src/hooks/useProtectedRoute.ts
// Auth-gated navigation — redirects based on session state
//
// Extracted from app/_layout.tsx (Phase 3 refactor)
// No logic changes — identical to the inline version.

import { useEffect, useRef } from "react";
import {
  useRouter,
  useSegments,
  useRootNavigationState,
  Href,
} from "expo-router";
import { useNavigationStore } from "@/stores/navigationStore";
import type { Session } from "@supabase/supabase-js";

/**
 * Gates navigation based on auth state.
 * - Unauthenticated users → auth screens
 * - Authenticated users → tabs (or onboarding if needed)
 * - Respects navigation lock from auth screen sign-in flow
 */
export function useProtectedRoute(session: Session | null, isLoading: boolean) {
  const segments = useSegments() as string[];
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // Check if auth screen is handling navigation (sign-in flow)
  // Uses isNavigationLocked() to auto-clear stale locks
  const isNavigationLocked = useNavigationStore(
    (state) => state.isNavigationLocked,
  );

  // Track navigation attempts to prevent duplicates
  const lastNavigationTarget = useRef<string | null>(null);
  const navigationInProgress = useRef(false);

  useEffect(() => {
    const LOG = "[ProtectedRoute]";
    const currentPath = "/" + segments.join("/");

    // Wait for all required data to be ready
    if (isLoading) {
      console.log(`${LOG} Waiting... isLoading=${isLoading}`);
      return;
    }

    // Wait for navigation state to be ready
    if (!navigationState?.key) {
      console.log(`${LOG} Waiting for navigation state...`);
      return;
    }

    // If auth screen is handling sign-in flow, don't interfere
    // isNavigationLocked() will auto-clear stale locks (>30s)
    const locked = isNavigationLocked();
    console.log(
      `${LOG} Check: session=${!!session}, locked=${locked}, path=${currentPath}`,
    );
    if (locked) {
      console.log(`${LOG} ⏸Navigation locked, deferring redirect decision`);
      return;
    }

    const firstSegment = segments[0];
    const secondSegment = segments[1] as string | undefined;

    // Determine where we are
    const atRoot = !firstSegment;
    const inAuth = firstSegment === "(auth)";
    const inTabs = firstSegment === "(tabs)";
    const inOnboarding = inAuth && secondSegment === "onboarding";

    // Route targets
    const targetAuth = "/(auth)/welcome";
    const targetTabs = "/(tabs)";

    // Check if user needs onboarding
    // Uses user_metadata to avoid waiting for profile query
    const needsOnboarding =
      session && session.user.user_metadata?.onboarding_completed === false;

    console.log(
      `${LOG} State: atRoot=${atRoot}, inAuth=${inAuth}, inTabs=${inTabs}, needsOnboarding=${needsOnboarding}`,
    );

    // Helper to navigate only if not already navigating to same target
    // Uses ref to prevent duplicate navigation attempts within same render cycle
    const navigateTo = (target: string) => {
      // Skip if we just navigated to this target
      if (
        lastNavigationTarget.current === target &&
        navigationInProgress.current
      ) {
        console.log(`${LOG} Skip duplicate navigation to ${target}`);
        return;
      }

      // Skip if we're already at this location
      if (currentPath === target || currentPath.startsWith(target)) {
        console.log(`${LOG} Already at ${target}`);
        lastNavigationTarget.current = null;
        navigationInProgress.current = false;
        return;
      }

      navigationInProgress.current = true;
      lastNavigationTarget.current = target;
      console.log(`${LOG} NAVIGATING: ${currentPath} → ${target}`);
      router.replace(target as Href);
    };

    // Reset navigation tracking when segments change (navigation completed)
    if (lastNavigationTarget.current && !navigationInProgress.current) {
      lastNavigationTarget.current = null;
    }

    // =========================================================================
    // CASE 1: No session - redirect to auth
    // =========================================================================
    if (!session) {
      console.log(`${LOG} CASE 1: No session`);
      if (!inAuth) {
        console.log(`${LOG}   → Redirect to auth`);
        navigateTo(targetAuth);
      } else {
        console.log(`${LOG}   → Already in auth, staying`);
        navigationInProgress.current = false;
        lastNavigationTarget.current = null;
      }
      return;
    }

    // =========================================================================
    // CASE 2: Session exists - user is authenticated
    // =========================================================================
    console.log(`${LOG} CASE 2: Has session`);

    // Skip if in onboarding flow
    if (inOnboarding) {
      console.log(`${LOG}   → In onboarding, staying`);
      navigationInProgress.current = false;
      lastNavigationTarget.current = null;
      return;
    }

    // Already in tabs
    if (inTabs) {
      // New social auth users may still need onboarding
      if (needsOnboarding) {
        console.log(`${LOG}   → In tabs but needs onboarding, redirecting`);
        navigateTo("/(auth)/onboarding");
        return;
      }
      console.log(`${LOG}   → Already in tabs`);
      navigationInProgress.current = false;
      lastNavigationTarget.current = null;
      return;
    }

    // At root (initial app load with session)
    if (atRoot) {
      console.log(`${LOG}   → At root, need to redirect`);
      if (needsOnboarding) {
        console.log(`${LOG}   → To onboarding`);
        navigateTo("/(auth)/onboarding");
      } else {
        console.log(`${LOG}   → To tabs (home)`);
        navigateTo(targetTabs);
      }
      return;
    }

    // In auth screens with valid session
    // This handles: app restored from background with existing session
    if (inAuth) {
      if (needsOnboarding) {
        navigateTo("/(auth)/onboarding");
      } else {
        navigateTo(targetTabs);
      }
    }
  }, [
    session,
    segments,
    isLoading,
    router,
    navigationState?.key,
    isNavigationLocked,
  ]);
}

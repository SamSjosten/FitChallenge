#!/bin/bash
# Phase 4: Component Directory Restructuring
# 
# WHAT THIS DOES:
#   1. Deletes dead code (old shared/ files, ui.tsx)
#   2. Removes old v2/, challenge-detail-v2/, hooks/v2/ directories
#   3. Creates new feature-based directories (already copied by you)
#   4. Updates import paths in all consumer files
#
# PREREQUISITES: 
#   - Phases 1-3 already applied to your codebase
#   - You've already copied the phase4-deliverable/src/ directories into your project
#
# USAGE: Run from your FitChallenge project root
#   chmod +x phase4-migrate.sh
#   ./phase4-migrate.sh

set -e
echo "Phase 4: Component Directory Restructuring"
echo "==========================================="
echo ""

# Safety check
if [ ! -d "src/components" ] || [ ! -f "app/(tabs)/index.tsx" ]; then
  echo "ERROR: Run this from your FitChallenge project root"
  exit 1
fi

# Check that new directories were copied
if [ ! -d "src/components/shared" ] || [ ! -f "src/components/shared/index.ts" ]; then
  echo "ERROR: Copy phase4-deliverable/src/ into your project first"
  echo "  cp -r phase4-deliverable/src/components/shared src/components/"
  echo "  cp -r phase4-deliverable/src/components/home src/components/"
  echo "  etc."
  exit 1
fi

echo "Step 1: Delete dead code from old shared/"
rm -f src/components/shared/AnimatedCard.tsx
rm -f src/components/shared/Button.tsx
rm -f src/components/shared/FilterDropdown.tsx
rm -f src/components/shared/HealthBadge.tsx
rm -f src/components/shared/ProgressRing.tsx
rm -f src/components/shared/StreakBanner.tsx  # Replaced by home/StreakBanner.tsx
echo "  Done."

echo "Step 2: Delete ui.tsx monolith"
rm -f src/components/ui.tsx
echo "  Done."

echo "Step 3: Delete old v2/ directory"
rm -rf src/components/v2
echo "  Done."

echo "Step 4: Delete old challenge-detail-v2/ directory"
rm -rf src/components/challenge-detail-v2
echo "  Done."

echo "Step 5: Delete old hooks/v2/ directory"
rm -rf src/hooks/v2
echo "  Done."

echo "Step 6: Delete old root NotificationsScreen.tsx (replaced by notifications/)"
rm -f src/components/NotificationsScreen.tsx
echo "  Done."

echo "Step 7: Update import paths in app/ consumer files"

# Generic find-and-replace function
replace_import() {
  local file="$1"
  local old="$2"
  local new="$3"
  if [ -f "$file" ]; then
    sed -i '' "s|${old}|${new}|g" "$file" 2>/dev/null || sed -i "s|${old}|${new}|g" "$file"
  fi
}

# ---- BARREL IMPORTS: @/components/v2 → @/components/shared ----
# These files import from the v2 barrel and need to switch to shared barrel
for f in \
  "app/(tabs)/challenges.tsx" \
  "app/(tabs)/friends.tsx" \
  "app/(tabs)/index.tsx" \
  "app/activity/index.tsx" \
  "app/activity/[id].tsx" \
  "app/invite/[id].tsx"; do
  replace_import "$f" '@/components/v2"' '@/components/shared"'
done

# ---- SPECIFIC: @/components/v2/Toast → @/components/shared/Toast ----
replace_import "app/(tabs)/index.tsx" '@/components/v2/Toast' '@/components/shared/Toast'

# ---- SPECIFIC: @/components/v2/ActivityCard → @/components/shared/ActivityCard ----
replace_import "app/activity/index.tsx" '@/components/v2/ActivityCard' '@/components/shared/ActivityCard'

# ---- HOME SCREEN: @/hooks/v2 barrel → individual hooks ----
# Original: import { useHomeScreenData, useChallengeFilters } from "@/hooks/v2";
# New:      import { useHomeScreenData } from "@/hooks/useHomeScreenData";
#           import { useChallengeFilters } from "@/hooks/useChallengeFilters";
# This one needs manual verification - the sed below handles the common barrel pattern
replace_import "app/(tabs)/index.tsx" 'from "@/hooks/v2"' 'from "@/hooks/useHomeScreenData"'
echo "  NOTE: Verify app/(tabs)/index.tsx hooks import - may need manual split"
echo "        If it was: import { useHomeScreenData, useChallengeFilters } from \"@/hooks/v2\""
echo "        Change to: import { useHomeScreenData } from \"@/hooks/useHomeScreenData\""
echo "                   import { useChallengeFilters } from \"@/hooks/useChallengeFilters\""

# ---- HOME COMPONENTS: v2/home barrel imports ----
# These were likely imported individually from @/components/v2 barrel
# No separate change needed - the shared barrel already covers it
# But if any file imports from @/components/v2/home specifically:
for f in "app/(tabs)/index.tsx"; do
  replace_import "$f" '@/components/v2/home"' '@/components/home"'
  replace_import "$f" '@/components/v2/home/' '@/components/home/'
done

# ---- CHALLENGE DETAIL: @/components/challenge-detail-v2 → @/components/challenge-detail ----
replace_import "app/challenge/[id].tsx" '@/components/challenge-detail-v2' '@/components/challenge-detail'

# ---- CHALLENGE DETAIL: ChallengeDetailScreenV2 → ChallengeDetailScreen ----
replace_import "app/challenge/[id].tsx" 'ChallengeDetailScreenV2' 'ChallengeDetailScreen'

# ---- CREATE: @/components/v2/create → @/components/create-challenge ----
replace_import "app/challenge/create.tsx" '@/components/v2/create' '@/components/create-challenge'

# ---- NOTIFICATIONS: V2NotificationsScreen → NotificationsScreen ----
replace_import "app/notifications.tsx" 'V2NotificationsScreen' 'NotificationsScreen'
replace_import "app/notifications.tsx" '@/components/v2"' '@/components/notifications"'
replace_import "app/notifications.tsx" '@/components/v2/' '@/components/notifications/'

# ---- UI.TSX IMPORTS: @/components/ui → @/components/shared or individual ----
# Avatar, ProgressBar, LoadingScreen were in ui.tsx, now in shared/
replace_import "app/(tabs)/profile.tsx" 'from "@/components/ui"' 'from "@/components/shared"'
replace_import "app/challenge/[id].tsx" 'from "@/components/ui"' 'from "@/components/shared"'

# ServerTimeBanner and OfflineIndicator were re-exports from ui.tsx
# They still exist at their own paths - update to import directly
replace_import "app/_layout.tsx" '{ ServerTimeBanner, OfflineIndicator } from "@/components/ui"' '{ ServerTimeBanner } from "@/components/ServerTimeBanner"'
# Add separate OfflineIndicator import - this needs manual check
echo "  NOTE: Check app/_layout.tsx - if it imported {ServerTimeBanner, OfflineIndicator} from ui"
echo "        Change to separate imports from @/components/ServerTimeBanner and @/components/OfflineIndicator"

# ---- TEST FILES ----
if [ -f "src/__tests__/component/notifications.component.test.tsx" ]; then
  replace_import "src/__tests__/component/notifications.component.test.tsx" '@/components/v2' '@/components/notifications'
  replace_import "src/__tests__/component/notifications.component.test.tsx" 'V2NotificationsScreen' 'NotificationsScreen'
fi

echo "  Done."

echo ""
echo "==========================================="
echo "Phase 4 migration complete!"
echo ""
echo "NEXT STEPS:"
echo "  1. Run: npx tsc --noEmit"
echo "     TypeScript will catch any missed import paths"
echo ""
echo "  2. Check these files manually:"
echo "     - app/(tabs)/index.tsx (hooks barrel → individual imports)"
echo "     - app/_layout.tsx (ui.tsx re-exports → direct imports)"
echo "     - app/notifications.tsx (V2 prefix removal)"
echo ""
echo "  3. Run: npx expo start --dev-client --clear"
echo "     Verify the app loads correctly"
echo ""
echo "  4. Run your test suite"

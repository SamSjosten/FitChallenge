// e2e/utils/index.ts
// ============================================
// E2E Test Utilities Export
// ============================================

// Test helpers
export {
  TEST_USERS,
  DEFAULT_TIMEOUT,
  SHORT_TIMEOUT,
  EXTENDED_TIMEOUT,
  waitForElement,
  waitForElementToDisappear,
  waitForText,
  tapElement,
  tapText,
  longPressElement,
  typeText,
  clearAndTypeText,
  replaceText,
  scrollDown,
  scrollUp,
  scrollToElement,
  swipeLeft,
  swipeRight,
  assertVisible,
  assertNotVisible,
  assertTextVisible,
  assertExists,
  assertHasText,
  takeScreenshot,
  backgroundAndForeground,
  shakeDevice,
  setOrientation,
  dismissKeyboard,
  goOffline,
  goOnline,
  resetAppState,
  ensureSignedOut,
} from "./testHelpers";

// Auth helpers
export {
  signIn,
  signInAsPrimaryUser,
  signInAsSecondaryUser,
  signUp,
  signUpNewUser,
  signOut,
  requestPasswordReset,
  assertFieldError,
  assertSignInError,
  assertSignUpError,
  isSignedIn,
  ensureSignedOutState,
  ensureSignedInState,
  completeOnboarding,
  skipOnboardingIfPresent,
} from "./authHelpers";

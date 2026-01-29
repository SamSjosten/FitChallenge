// src/constants/testIDs.ts
// Centralized testID constants for E2E testing
//
// Usage in components:
//   import { TestIDs } from '@/constants/testIDs';
//   <View testID={TestIDs.screens.home}>
//
// Usage in E2E tests:
//   await waitForElement(TestIDs.screens.home);
//   await tapElement(TestIDs.buttons.signIn);
//
// IMPORTANT: Keep this file in sync with e2e/setup.ts helpers

export const TestIDs = {
  // ===========================================================================
  // SCREENS (root View of each screen)
  // ===========================================================================
  screens: {
    login: "login-screen",
    signup: "signup-screen",
    home: "home-screen",
    challenges: "challenges-screen",
    friends: "friends-screen",
    profile: "profile-screen",
    settings: "settings-screen",
    healthSettings: "health-settings-screen",
    createChallenge: "create-challenge-screen",
    challengeDetail: "challenge-detail-screen",
    notifications: "notifications-screen",
  },

  // ===========================================================================
  // AUTH SCREENS
  // ===========================================================================
  auth: {
    // Login
    emailInput: "email-input",
    passwordInput: "password-input",
    signInButton: "signin-button",
    signUpLink: "signup-link",
    loginError: "login-error",

    // Signup
    usernameInput: "username-input",
    signUpButton: "signup-button",
    signInLink: "signin-link",
    signupError: "signup-error",
    usernameError: "username-error",
    emailError: "email-error",
    passwordError: "password-error",
  },

  // ===========================================================================
  // NAVIGATION
  // ===========================================================================
  nav: {
    tabHome: "tab-home",
    tabChallenges: "tab-challenges",
    tabCreate: "tab-create",
    tabFriends: "tab-friends",
    tabProfile: "tab-profile",
    createChallengeFab: "create-challenge-fab",
    backButton: "back-button",
    notificationBell: "notification-bell",
    notificationBadge: "notification-badge",
  },

  // ===========================================================================
  // HOME SCREEN
  // ===========================================================================
  home: {
    streakBanner: "streak-banner",
    streakCount: "streak-count",

    // Pending Invites Section
    pendingInvitesSection: "pending-invites-section",
    pendingInviteCard: (id: string) => `pending-invite-${id}`,
    acceptInviteButton: (id: string) => `accept-invite-${id}`,
    declineInviteButton: (id: string) => `decline-invite-${id}`,

    // Active Challenges Section
    activeChallengesSection: "active-challenges-section",
    activeChallengeCard: (id: string) => `active-challenge-${id}`,
    challengeCardTitle: (id: string) => `challenge-title-${id}`,
    challengeCardProgress: (id: string) => `challenge-progress-${id}`,
    viewChallengeButton: (id: string) => `view-challenge-${id}`,

    // Completed Section
    completedSection: "completed-section",
    completedToggle: "completed-toggle",
    completedChallengeRow: (id: string) => `completed-challenge-${id}`,

    // Empty States
    emptyActiveChallenges: "empty-active-challenges",
    createFirstChallengeButton: "create-first-challenge-button",
  },

  // ===========================================================================
  // CREATE CHALLENGE SCREEN
  // ===========================================================================
  createChallenge: {
    // Form inputs
    titleInput: "challenge-title-input",
    descriptionInput: "challenge-description-input",
    goalInput: "challenge-goal-input",
    customUnitInput: "challenge-custom-unit-input",

    // Challenge type buttons
    typeSteps: "challenge-type-steps",
    typeActiveMinutes: "challenge-type-active_minutes",
    typeWorkouts: "challenge-type-workouts",
    typeDistance: "challenge-type-distance",
    typeCustom: "challenge-type-custom",

    // Duration buttons
    duration7: "duration-7",
    duration14: "duration-14",
    duration30: "duration-30",
    durationCustom: "duration-custom",
    customDurationInput: "custom-duration-input",

    // Date pickers
    startDatePicker: "start-date-picker",
    endDatePicker: "end-date-picker",

    // Actions
    createButton: "create-challenge-button",
    cancelButton: "cancel-create-button",

    // Validation errors
    titleError: "title-error",
    goalError: "goal-error",
    durationError: "duration-error",
  },

  // ===========================================================================
  // CHALLENGE DETAIL SCREEN
  // ===========================================================================
  challengeDetail: {
    // Header
    challengeTitle: "challenge-detail-title",
    challengeStatus: "challenge-status",
    daysRemaining: "days-remaining",

    // Progress Card
    progressCard: "progress-card",
    progressBar: "progress-bar",
    progressText: "progress-text",

    // Actions
    logActivityButton: "log-activity-button",
    inviteButton: "invite-button",
    leaveButton: "leave-challenge-button",
    cancelChallengeButton: "cancel-challenge-button",

    // Leaderboard
    leaderboardSection: "leaderboard-section",
    leaderboardLocked: "leaderboard-locked",
    leaderboardEntry: (index: number) => `leaderboard-entry-${index}`,
    leaderboardEntryByUsername: (username: string) =>
      `leaderboard-entry-${username}`,
    leaderboardEntryHighlighted: (username: string) =>
      `leaderboard-entry-${username}-highlighted`,
    leaderboardEntryAvatar: (index: number) =>
      `leaderboard-entry-${index}-avatar`,
    leaderboardEntryRank: (index: number) => `leaderboard-entry-${index}-rank`,
    leaderboardEntryProgress: (index: number) =>
      `leaderboard-entry-${index}-progress`,

    // Participants Section (for creator)
    participantsSection: "participants-section",
    participantRow: (id: string) => `participant-${id}`,
    participantStatus: (id: string) => `participant-status-${id}`,
  },

  // ===========================================================================
  // LOG ACTIVITY MODAL
  // ===========================================================================
  logActivity: {
    modal: "log-activity-modal",
    valueInput: "activity-value-input",
    submitButton: "submit-activity-button",
    cancelButton: "cancel-activity-button",
    valueError: "activity-value-error",
    successMessage: "activity-logged-success",
  },

  // ===========================================================================
  // INVITE MODAL
  // ===========================================================================
  invite: {
    modal: "invite-modal",
    searchInput: "user-search-input",
    searchButton: "search-users-button",
    closeButton: "close-modal-button",
    noResultsMessage: "no-users-found",
    userResult: (id: string) => `user-result-${id}`,
    sendInviteButton: (id: string) => `send-invite-${id}`,
    inviteSentMessage: "invite-sent-message",
  },

  // ===========================================================================
  // PROFILE SCREEN
  // ===========================================================================
  profile: {
    username: "profile-username",
    displayName: "profile-display-name",
    avatar: "profile-avatar",
    xpCount: "profile-xp",
    streakCount: "profile-streak",
    settingsButton: "settings-button",
    editProfileButton: "edit-profile-button",

    // Stats
    statsSection: "profile-stats-section",
    challengesCompleted: "challenges-completed-count",
    totalActivities: "total-activities-count",
  },

  // ===========================================================================
  // SETTINGS SCREEN
  // ===========================================================================
  settings: {
    signOutButton: "signout-button",
    deleteAccountButton: "delete-account-button",
    exportDataButton: "export-data-button",
    notificationToggle: "notification-toggle",
    darkModeToggle: "dark-mode-toggle",
    versionText: "app-version",
    healthDataButton: "health-data-button",
    developerButton: "developer-settings-button",
  },

  // ===========================================================================
  // HEALTH SETTINGS SCREEN
  // ===========================================================================
  healthSettings: {
    connectionStatus: "health-connection-status",
    providerName: "health-provider-name",
    lastSyncTime: "health-last-sync",
    connectButton: "health-connect-button",
    disconnectButton: "health-disconnect-button",
    syncButton: "health-sync-button",
    syncHistorySection: "health-sync-history",
    syncHistoryItem: (id: string) => `health-sync-log-${id}`,
    permissionsList: "health-permissions-list",
    syncResultProcessed: "sync-result-processed",
    syncResultInserted: "sync-result-inserted",
    syncResultDeduplicated: "sync-result-deduplicated",
  },

  // ===========================================================================
  // FRIENDS SCREEN
  // ===========================================================================
  friends: {
    friendsList: "friends-list",
    friendRow: (id: string) => `friend-${id}`,
    searchInput: "friends-search-input",
    pendingRequestsSection: "pending-requests-section",
    pendingRequestRow: (id: string) => `pending-request-${id}`,
    acceptFriendButton: (id: string) => `accept-friend-${id}`,
    declineFriendButton: (id: string) => `decline-friend-${id}`,
    addFriendButton: "add-friend-button",
    emptyFriendsList: "empty-friends-list",
  },

  // ===========================================================================
  // COMMON UI ELEMENTS
  // ===========================================================================
  common: {
    loadingIndicator: "loading-indicator",
    errorMessage: "error-message",
    retryButton: "retry-button",
    emptyState: "empty-state",
    offlineIndicator: "offline-indicator",
    refreshControl: "refresh-control",
  },

  // ===========================================================================
  // ALERTS (for Alert.alert confirmations)
  // ===========================================================================
  alerts: {
    okButton: "alert-ok-button",
    cancelButton: "alert-cancel-button",
    confirmButton: "alert-confirm-button",
  },

  // ===========================================================================
  // DEVELOPER SETTINGS SCREEN
  // ===========================================================================
  developerSettings: {
    screen: "developer-settings-screen",
    uiVersionToggle: "ui-version-toggle",
    resetButton: "reset-ui-version-button",
    currentVersionLabel: "current-ui-version",
  },

  // ===========================================================================
  // V2 SCREENS (new UI version)
  // ===========================================================================
  screensV2: {
    home: "home-screen-v2",
    challenges: "challenges-screen-v2",
    friends: "friends-screen-v2",
    profile: "profile-screen-v2",
  },
} as const;

// Type helper for dynamic testIDs
export type TestID = string;

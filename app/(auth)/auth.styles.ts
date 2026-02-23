// app/(auth)/auth.styles.ts
// V2 Auth screen styles — deep emerald, AVVIO branding, PlusJakartaSans
//
// Key changes from V1:
// - Deep emerald gradient (matches welcome screen)
// - AVVIO wordmark + diamond ornament (replaces trophy icon + circles)
// - PlusJakartaSans font family throughout
// - Terms pinned to bottom via flex spacer
// - Orbital arc styles for animated header background

import { StyleSheet, Dimensions } from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ── Header (deep emerald gradient area) ────────────────────────────────
  header: {
    paddingBottom: 72,
    paddingHorizontal: 24,
    position: "relative",
    overflow: "hidden",
  },

  // Orbital arcs
  orbitalContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  orbitalArcWrapper: {
    position: "absolute",
    width: SCREEN_W,
    height: "100%",
  },

  backButton: {
    position: "absolute",
    left: 16,
    padding: 8,
    zIndex: 10,
  },
  headerContent: {
    alignItems: "center",
    marginTop: 24,
  },

  // AVVIO wordmark (replaces trophy icon)
  avvioTitle: {
    fontSize: 32,
    fontFamily: "PlusJakartaSans_800ExtraBold",
    color: "#FFFFFF",
    letterSpacing: -1.5,
    marginBottom: 14,
  },

  // Diamond ornament
  ornamentContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  ornamentLine: {
    width: 30,
    height: 1,
    backgroundColor: "#34D399",
    opacity: 0.35,
  },
  diamond: {
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: "#34D399",
    opacity: 0.5,
    transform: [{ rotate: "45deg" }],
  },

  headerSubtitle: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "rgba(236, 253, 245, 0.9)",
  },

  // ── Form Card ──────────────────────────────────────────────────────────
  formCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },

  // Mode Toggle
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#6B7280",
  },
  modeButtonTextActive: {
    color: "#111827",
  },

  // Form Fields
  formFields: {
    marginBottom: 24,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    color: "#DC2626",
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 20,
  },
  rememberForgotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rememberMeSwitch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
    marginRight: 4,
  },
  rememberMeText: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_400Regular",
    color: "#6B7280",
  },
  rightControls: {
    flexDirection: "row",
    alignItems: "center",
  },

  // Submit Button
  submitButton: {
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },

  // Flex spacer — pushes terms to bottom of card
  termsSpacer: {
    flex: 1,
    minHeight: 8,
  },

  // Terms (pinned to bottom via spacer above)
  termsText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 18,
    paddingBottom: 8,
  },
  termsLink: {
    color: "#059669",
  },
});

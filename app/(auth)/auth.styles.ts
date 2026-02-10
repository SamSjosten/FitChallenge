// app/(auth)/auth.styles.ts
// Extracted from auth.tsx — StyleSheet for V2 auth screen

import { StyleSheet } from "react-native";

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
    justifyContent: "flex-end",
  },

  // Header
  header: {
    paddingBottom: 100,
    paddingHorizontal: 24,
    position: "relative",
    overflow: "hidden",
  },
  circleDecor1: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    left: "10%",
    top: "20%",
  },
  circleDecor2: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    left: "70%",
    top: "20%",
  },
  circleDecor3: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    left: "10%",
    top: "70%",
  },
  circleDecor4: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    left: "70%",
    top: "70%",
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
  iconContainer: {
    width: 64,
    height: 64,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(236, 253, 245, 0.9)",
  },

  // Form Card
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
    fontWeight: "600",
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
    borderRadius: 12,
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
    fontWeight: "600",
  },

  // Terms
  termsText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 24,
    lineHeight: 18,
  },
  termsLink: {
    color: "#059669",
  },
});

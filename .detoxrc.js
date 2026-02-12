/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: "jest",
      config: "e2e/jest.config.js",
    },
    jest: {
      setupTimeout: 120000,
      retryAfterCircusRetries: 1,
    },
  },
  apps: {
    // Debug builds - faster iteration during development
    "ios.debug": {
      type: "ios.app",
      binaryPath: "ios/build/Build/Products/Debug-iphonesimulator/FitChallenge.app",
      build:
        "xcodebuild -workspace ios/FitChallenge.xcworkspace -scheme FitChallenge -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build",
    },
    "android.debug": {
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/debug/app-debug.apk",
      build: "cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug",
    },
    // Release builds - for CI and final validation
    "ios.release": {
      type: "ios.app",
      binaryPath: "ios/build/Build/Products/Release-iphonesimulator/FitChallenge.app",
      build:
        "xcodebuild -workspace ios/FitChallenge.xcworkspace -scheme FitChallenge -configuration Release -sdk iphonesimulator -derivedDataPath ios/build",
    },
    "android.release": {
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/release/app-release.apk",
      build: "cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release",
    },
  },
  devices: {
    // iOS Simulators - various screen sizes
    "iphone.16.pro.max": {
      type: "ios.simulator",
      device: { type: "iPhone 16 Pro Max" }, // largest
    },
    "iphone.16": {
      type: "ios.simulator",
      device: { type: "iPhone 16" }, // standard
    },
    "iphone.se": {
      type: "ios.simulator",
      device: { type: "iPhone SE (3rd generation)" }, // smallest
    },
    "iphone.14": {
      type: "ios.simulator",
      device: { type: "iPhone 14" }, // previous gen
    },
    // Default simulator (for local dev)
    simulator: {
      type: "ios.simulator",
      device: { type: "iPhone 16" },
    },
    // Android Emulator
    emulator: {
      type: "android.emulator",
      device: { avdName: "Pixel_4_API_34" },
    },
  },
  configurations: {
    // Debug configurations - for local development
    "ios.sim.debug": {
      device: "simulator",
      app: "ios.debug",
    },
    "android.emu.debug": {
      device: "emulator",
      app: "android.debug",
    },
    // Release configurations - for CI (default device)
    "ios.sim.release": {
      device: "simulator",
      app: "ios.release",
    },
    "android.emu.release": {
      device: "emulator",
      app: "android.release",
    },
    // Release configurations - for CI matrix (specific devices)
    "ios.sim.release.iphone16promax": {
      device: "iphone.16.pro.max",
      app: "ios.release",
    },
    "ios.sim.release.iphone16": {
      device: "iphone.16",
      app: "ios.release",
    },
    "ios.sim.release.iphonese": {
      device: "iphone.se",
      app: "ios.release",
    },
    "ios.sim.release.iphone14": {
      device: "iphone.14",
      app: "ios.release",
    },
  },
  // Artifacts configuration for debugging failures
  artifacts: {
    rootDir: "e2e/.artifacts",
    plugins: {
      screenshot: {
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: true,
        takeWhen: {
          testStart: false,
          testDone: true,
        },
      },
      video: {
        enabled: false, // Enable for debugging specific issues
      },
      log: {
        enabled: true,
      },
    },
  },
  // Behavior settings
  behavior: {
    init: {
      exposeGlobals: true,
    },
    launchApp: "auto",
    cleanup: {
      shutdownDevice: false, // Keep device running for faster re-runs
    },
  },
};

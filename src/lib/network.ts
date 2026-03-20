import NetInfo from "@react-native-community/netinfo";

/**
 * Non-hook utility to check network status.
 * Use this in service code where hooks are unavailable.
 */
export async function checkNetworkStatus(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
}

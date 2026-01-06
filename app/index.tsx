// app/index.tsx
// Root redirect - handled by _layout auth logic

import { Redirect } from 'expo-router';

export default function Index() {
  // This redirect is a fallback - the _layout handles auth-based routing
  return <Redirect href="/(tabs)" />;
}

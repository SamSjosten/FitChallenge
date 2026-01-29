// app/index.tsx
// Root index - renders nothing, routing handled by _layout.tsx useProtectedRoute
//
// WHY: The useProtectedRoute hook in _layout.tsx handles all auth-based routing.
// Having a <Redirect> here causes race conditions and navigation loops because:
// 1. This redirect fires immediately
// 2. useProtectedRoute also fires and may redirect elsewhere
// 3. During transitions, navigation state becomes undefined
// 4. Both keep trying to redirect = infinite loop
//
// SOLUTION: Render nothing here. useProtectedRoute will redirect to the correct
// destination based on auth state and UI version (v1 vs v2).

import { View } from "react-native";

export default function Index() {
  // Render nothing - useProtectedRoute handles navigation
  return <View />;
}

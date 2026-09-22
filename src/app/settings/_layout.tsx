import { Stack } from "expo-router/stack";

import { useAppColors } from "@/theme/tokens";

export default function SettingsLayout() {
  const colors = useAppColors();
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="take-home"
        options={{ headerBackTitle: "Settings", title: "Take-home" }}
      />
    </Stack>
  );
}

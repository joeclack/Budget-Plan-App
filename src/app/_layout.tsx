import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { DatabaseProvider } from "@/db/provider";
import { palette, useAppColors } from "@/theme/tokens";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = useAppColors();
  const isDark = colorScheme === "dark";
  const theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      border: colors.border,
      card: colors.surface,
      primary: colors.accent,
      text: colors.text,
    },
  };

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
    StatusBar.setStyle(isDark ? "light" : "dark");
  }, [colors.background, isDark]);

  return (
    <DatabaseProvider>
      <ThemeProvider value={theme}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <NativeTabs
          backgroundColor={isDark ? palette.ink900 : palette.paper}
          blurEffect={isDark ? "systemMaterialDark" : "systemMaterialLight"}
          iconColor={{
            default: isDark ? palette.slate400 : palette.slate500,
            selected: palette.blue500,
          }}
          labelStyle={{
            default: { color: isDark ? palette.slate400 : palette.slate500 },
            selected: { color: palette.blue500, fontWeight: "600" },
          }}
          minimizeBehavior="onScrollDown"
          tintColor={palette.blue500}
        >
          <NativeTabs.Trigger
            name="index"
            contentStyle={{ backgroundColor: colors.background }}
          >
            <NativeTabs.Trigger.Icon
              sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
            />
            <NativeTabs.Trigger.Label>Budget</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger
            name="settings"
            contentStyle={{ backgroundColor: colors.background }}
          >
            <NativeTabs.Trigger.Icon
              md="settings"
              sf={{ default: "gearshape", selected: "gearshape.fill" }}
            />
            <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        </NativeTabs>
      </ThemeProvider>
    </DatabaseProvider>
  );
}

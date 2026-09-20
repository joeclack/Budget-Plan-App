import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

import { DatabaseProvider } from "@/db/provider";
import { palette } from "@/theme/tokens";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const tabs = (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
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
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon
            sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          />
          <NativeTabs.Trigger.Label>Budget</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="take-home">
          <NativeTabs.Trigger.Icon
            sf={{
              default: "sterlingsign.circle",
              selected: "sterlingsign.circle.fill",
            }}
          />
          <NativeTabs.Trigger.Label>Take-home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );

  return <DatabaseProvider>{tabs}</DatabaseProvider>;
}

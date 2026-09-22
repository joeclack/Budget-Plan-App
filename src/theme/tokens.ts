import { useColorScheme } from "react-native";

export const palette = {
  blue500: "#2176FF",
  blue950: "#0A2450",
  ink950: "#07111F",
  ink900: "#0C1726",
  paper: "#F6F8FC",
  white: "#FFFFFF",
  slate200: "#DDE3EC",
  slate400: "#8A98AB",
  slate500: "#637083",
  slate900: "#142033",
} as const;

const lightColors = {
  accent: palette.blue500,
  accentBorder: "#BFD7FF",
  accentSoft: "#EAF2FF",
  background: palette.paper,
  border: palette.slate200,
  buttonText: palette.white,
  control: "rgba(255,255,255,0.92)",
  controlBorder: "rgba(21,44,80,0.14)",
  hero: palette.blue950,
  heroBorder: "#1C4B89",
  heroDivider: "rgba(255,255,255,0.24)",
  heroFill: ["#7EB0FF", "#D5E6FF"] as const,
  heroGradient: ["#06142C", "#0C316C", "#1A5AAB"] as const,
  heroOverFill: ["#F2C27A", "#FFF1D0"] as const,
  heroRing: "rgba(214,230,255,0.34)",
  heroSecondaryText: "#C8DCFA",
  heroSheen: ["rgba(186,214,255,0.34)", "rgba(186,214,255,0)"] as const,
  heroStub: "rgba(3,10,24,0.34)",
  heroText: palette.white,
  heroTrack: "rgba(255,255,255,0.16)",
  secondaryText: palette.slate500,
  separator: palette.slate200,
  surface: palette.white,
  text: palette.slate900,
};

const darkColors = {
  accent: "#63A4FF",
  accentBorder: "#214D7C",
  accentSoft: "#102A48",
  background: palette.ink950,
  border: "#26374C",
  buttonText: palette.ink950,
  control: "rgba(25,42,62,0.96)",
  controlBorder: "rgba(194,218,248,0.18)",
  hero: "#0C315F",
  heroBorder: "#275B94",
  heroDivider: "rgba(255,255,255,0.22)",
  heroFill: ["#7EB0FF", "#D5E6FF"] as const,
  heroGradient: ["#071E40", "#0E3C78", "#1C64B8"] as const,
  heroOverFill: ["#F2C27A", "#FFF1D0"] as const,
  heroRing: "rgba(214,230,255,0.28)",
  heroSecondaryText: "#BED8F6",
  heroSheen: ["rgba(190,220,255,0.24)", "rgba(190,220,255,0)"] as const,
  heroStub: "rgba(0,0,0,0.28)",
  heroText: palette.white,
  heroTrack: "rgba(255,255,255,0.14)",
  secondaryText: "#9CACBF",
  separator: "#26374C",
  surface: palette.ink900,
  text: "#F2F6FB",
};

export function useAppColors() {
  return useColorScheme() === "dark" ? darkColors : lightColors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = { md: 12, lg: 18, xl: 26, pill: 999 } as const;

export const typography = {
  display: {
    fontSize: 42,
    fontWeight: "700",
    letterSpacing: -1.3,
    lineHeight: 48,
  } as const,
  largeTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.8,
    lineHeight: 40,
  } as const,
  title2: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 28,
  } as const,
  title3: {
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.2,
    lineHeight: 25,
  } as const,
  headline: { fontSize: 17, fontWeight: "600", lineHeight: 22 } as const,
  body: { fontSize: 17, fontWeight: "400", lineHeight: 22 } as const,
  callout: { fontSize: 16, fontWeight: "500", lineHeight: 20 } as const,
  caption: { fontSize: 13, fontWeight: "500", lineHeight: 17 } as const,
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.9,
    lineHeight: 16,
  } as const,
};

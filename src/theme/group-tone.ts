import type { GroupColor } from "@/domain/budget";

export type GroupTone = {
  border: string;
  colors: readonly [string, string, string, string];
  end: { x: number; y: number };
  locations: readonly [number, number, number, number];
  sheen: readonly [string, string];
  start: { x: number; y: number };
  swatch: string;
};

const light: Record<GroupColor, GroupTone> = {
  sky: {
    swatch: "#3B82F6",
    border: "#C5DAF5",
    colors: ["#DCEBFF", "#EAF3FF", "#F5F9FF", "#FBFDFF"],
    locations: [0, 0.28, 0.68, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.72)", "rgba(255,255,255,0)"],
  },
  ocean: {
    swatch: "#14B8A6",
    border: "#B9E6DE",
    colors: ["#D8F6F1", "#E7F9F6", "#F3FCFA", "#FBFEFD"],
    locations: [0, 0.28, 0.68, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.7)", "rgba(255,255,255,0)"],
  },
  mint: {
    swatch: "#34D399",
    border: "#BFE9D2",
    colors: ["#DCF8EA", "#EAFBF2", "#F5FDF8", "#FBFEFC"],
    locations: [0, 0.28, 0.68, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.7)", "rgba(255,255,255,0)"],
  },
  sun: {
    swatch: "#F59E0B",
    border: "#F0D7A4",
    colors: ["#FFF1D2", "#FFF6E4", "#FFFBF3", "#FFFEFA"],
    locations: [0, 0.28, 0.68, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.62)", "rgba(255,255,255,0)"],
  },
  peach: {
    swatch: "#FB923C",
    border: "#F3CDB3",
    colors: ["#FFE6D4", "#FFF0E4", "#FFF7F1", "#FFFCF9"],
    locations: [0, 0.28, 0.68, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.64)", "rgba(255,255,255,0)"],
  },
  rose: {
    swatch: "#F43F5E",
    border: "#F0C4CC",
    colors: ["#FFE4EA", "#FFF0F3", "#FFF7F8", "#FFFCFC"],
    locations: [0, 0.28, 0.68, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.66)", "rgba(255,255,255,0)"],
  },
  orchid: {
    swatch: "#D946EF",
    border: "#E6C4F0",
    colors: ["#F8E5FC", "#FBF0FE", "#FDF7FF", "#FEFBFF"],
    locations: [0, 0.28, 0.68, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.68)", "rgba(255,255,255,0)"],
  },
  violet: {
    swatch: "#8B5CF6",
    border: "#D4C6F5",
    colors: ["#EDE4FF", "#F4EEFF", "#F9F6FF", "#FCFBFF"],
    locations: [0, 0.28, 0.68, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.7)", "rgba(255,255,255,0)"],
  },
};

const dark: Record<GroupColor, GroupTone> = {
  sky: {
    swatch: "#60A5FA",
    border: "#27466C",
    colors: ["#143056", "#10243F", "#0E1C32", "#0C1726"],
    locations: [0, 0.32, 0.7, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.07)", "rgba(255,255,255,0)"],
  },
  ocean: {
    swatch: "#2DD4BF",
    border: "#1F4D4A",
    colors: ["#123833", "#102C2B", "#0E2124", "#0C1726"],
    locations: [0, 0.32, 0.7, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"],
  },
  mint: {
    swatch: "#4ADE80",
    border: "#275241",
    colors: ["#143828", "#102A22", "#0E1F20", "#0C1726"],
    locations: [0, 0.32, 0.7, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"],
  },
  sun: {
    swatch: "#FBBF24",
    border: "#5A4524",
    colors: ["#3A2C16", "#261F14", "#161A1C", "#0C1726"],
    locations: [0, 0.32, 0.7, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.05)", "rgba(255,255,255,0)"],
  },
  peach: {
    swatch: "#FB923C",
    border: "#5A3A28",
    colors: ["#3A2418", "#271B16", "#17181C", "#0C1726"],
    locations: [0, 0.32, 0.7, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.05)", "rgba(255,255,255,0)"],
  },
  rose: {
    swatch: "#FB7185",
    border: "#5A3140",
    colors: ["#3A1C28", "#27161F", "#17161E", "#0C1726"],
    locations: [0, 0.32, 0.7, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"],
  },
  orchid: {
    swatch: "#E879F9",
    border: "#533057",
    colors: ["#331A3A", "#24152C", "#161622", "#0C1726"],
    locations: [0, 0.32, 0.7, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"],
  },
  violet: {
    swatch: "#A78BFA",
    border: "#3F3363",
    colors: ["#241A46", "#1A1734", "#121624", "#0C1726"],
    locations: [0, 0.32, 0.7, 1],
    start: { x: 0.02, y: 0 },
    end: { x: 1, y: 1 },
    sheen: ["rgba(255,255,255,0.07)", "rgba(255,255,255,0)"],
  },
};

export function groupTone(
  color: GroupColor | undefined,
  scheme: "light" | "dark",
): GroupTone | undefined {
  if (!color) return undefined;
  return (scheme === "dark" ? dark : light)[color];
}

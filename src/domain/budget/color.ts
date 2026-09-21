export const groupColors = [
  "sky",
  "ocean",
  "mint",
  "sun",
  "peach",
  "rose",
  "orchid",
  "violet",
] as const;

export type GroupColor = (typeof groupColors)[number];

export const groupColorLabels: Record<GroupColor, string> = {
  sky: "Sky",
  ocean: "Ocean",
  mint: "Mint",
  sun: "Sun",
  peach: "Peach",
  rose: "Rose",
  orchid: "Orchid",
  violet: "Violet",
};

export function isGroupColor(value: unknown): value is GroupColor {
  return (
    typeof value === "string" &&
    (groupColors as readonly string[]).includes(value)
  );
}

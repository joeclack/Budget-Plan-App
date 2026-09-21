import type { SFSymbol } from "sf-symbols-typescript";

export type HeaderIconMenuOption = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  systemImage?: SFSymbol;
};

export type HeaderIconMenuProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  options: HeaderIconMenuOption[];
  systemImage: "arrow.up.arrow.down" | "ellipsis.circle";
};

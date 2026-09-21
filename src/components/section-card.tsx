import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import {
  useEffect,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Money } from "@/components/money";
import type { GroupTone } from "@/theme/group-tone";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

const collapseTiming = {
  duration: 220,
  easing: Easing.out(Easing.cubic),
};

type SectionCardProps = PropsWithChildren<{
  collapsed?: boolean;
  collapsible?: boolean;
  emphasizedHeader?: boolean;
  footer?: ReactNode;
  onCollapsedChange?: (collapsed: boolean) => void;
  subtitle?: string;
  title: string;
  titleAccessory?: ReactNode;
  tone?: GroupTone;
  total?: number;
  totalContent?: ReactNode;
}>;

export function SectionCard({
  children,
  collapsed: collapsedProp,
  collapsible = false,
  emphasizedHeader = false,
  footer,
  onCollapsedChange,
  subtitle,
  title,
  titleAccessory,
  tone,
  total,
  totalContent,
}: SectionCardProps) {
  const colors = useAppColors();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const collapsed = onCollapsedChange
    ? Boolean(collapsedProp)
    : internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;
  const showBody = !collapsible || !collapsed;
  const progress = useSharedValue(collapsible && collapsed ? 0 : 1);
  const trailing =
    titleAccessory ??
    totalContent ??
    (total !== undefined ? <Money value={total} /> : null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!collapsible) return;
    progress.value = reduceMotion
      ? collapsed
        ? 0
        : 1
      : withTiming(collapsed ? 0 : 1, collapseTiming);
  }, [collapsed, collapsible, progress, reduceMotion]);

  const bodyStyle = useAnimatedStyle(() => {
    if (bodyHeight <= 0) {
      return collapsed
        ? { height: 0, overflow: "hidden" }
        : { overflow: "hidden" };
    }
    return {
      height: bodyHeight * progress.value,
      opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.45, 1]),
      overflow: "hidden",
      transform: [{ translateY: interpolate(progress.value, [0, 1], [-8, 0]) }],
    };
  });
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [-90, 0])}deg` },
    ],
  }));

  const titleStyle = [
    styles.title,
    emphasizedHeader && styles.emphasizedTitle,
    { color: colors.text },
  ];
  const titleLabel = (
    <Text accessibilityRole="header" style={titleStyle}>
      {title}
    </Text>
  );
  const collapseControl = collapsible ? (
    <Pressable
      accessibilityLabel={`${collapsed ? "Expand" : "Collapse"} ${title}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: !collapsed }}
      onPress={() => setCollapsed(!collapsed)}
      style={({ pressed }) => [
        styles.titlePressable,
        pressed && styles.pressed,
      ]}
    >
      {titleLabel}
      <Animated.View style={chevronStyle}>
        <SymbolView
          fallback={<Text style={{ color: colors.secondaryText }}>⌄</Text>}
          name="chevron.down"
          size={14}
          tintColor={colors.secondaryText}
          weight="semibold"
        />
      </Animated.View>
    </Pressable>
  ) : (
    titleLabel
  );

  function measureBody(height: number) {
    const next = Math.round(height);
    if (next > 0) setBodyHeight(next);
  }

  const cardStyle = [
    styles.card,
    {
      backgroundColor: tone ? "transparent" : colors.surface,
      borderColor: tone?.border ?? colors.border,
    },
  ];
  const contentStyle = [
    styles.cardContent,
    !showBody && !footer && styles.collapsedCard,
  ];

  return (
    <View style={cardStyle}>
      {tone ? (
        <View pointerEvents="none" style={styles.toneClip}>
          <LinearGradient
            colors={tone.colors}
            dither
            end={tone.end}
            locations={tone.locations}
            start={tone.start}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={tone.sheen}
            end={{ x: 0.9, y: 0.65 }}
            start={{ x: 0.1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      <View style={contentStyle}>
        <View
          style={[
            styles.header,
            emphasizedHeader &&
              showBody && [
                styles.emphasizedHeader,
                { borderBottomColor: colors.separator },
              ],
          ]}
        >
          <View style={styles.headerCopy}>
            {collapseControl}
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>
        {collapsible ? (
          <>
            {bodyHeight <= 0 ? (
              <View
                pointerEvents="none"
                style={styles.measure}
                onLayout={(event) =>
                  measureBody(event.nativeEvent.layout.height)
                }
              >
                {children}
              </View>
            ) : null}
            <Animated.View
              pointerEvents={collapsed ? "none" : "auto"}
              style={bodyStyle}
            >
              <View
                onLayout={(event) => {
                  if (!collapsed) measureBody(event.nativeEvent.layout.height);
                }}
              >
                {children}
              </View>
            </Animated.View>
          </>
        ) : (
          <View>{children}</View>
        )}
        {footer}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  cardContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  toneClip: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  collapsedCard: { paddingBottom: spacing.sm },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minWidth: 0,
    overflow: "hidden",
    paddingRight: spacing.md,
  },
  trailing: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    justifyContent: "center",
    zIndex: 1,
  },
  titlePressable: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    flexShrink: 1,
    gap: spacing.xs,
    maxWidth: "100%",
  },
  title: { ...typography.headline, flexShrink: 1 },
  pressed: { opacity: 0.65 },
  emphasizedHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
    paddingBottom: spacing.md,
  },
  emphasizedTitle: { fontSize: 19, fontWeight: "700", lineHeight: 24 },
  subtitle: typography.caption,
  measure: {
    left: 0,
    opacity: 0,
    position: "absolute",
    right: 0,
    zIndex: -1,
  },
});

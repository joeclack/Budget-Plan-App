import { SymbolView } from "expo-symbols";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { StyleSheet, Text, View } from "react-native";

import type { BudgetGroup } from "@/domain/budget";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

const rowHeight = 56;

type GroupReorderListProps = {
  disabled?: boolean;
  groups: BudgetGroup[];
  onDragEnd?: () => void;
  onDragStart?: () => void;
  onReorder: (from: number, to: number) => void;
};

export function GroupReorderList({
  disabled = false,
  groups,
  onDragEnd,
  onDragStart,
  onReorder,
}: GroupReorderListProps) {
  const colors = useAppColors();
  const dragIndex = useSharedValue(-1);
  const dragOffset = useSharedValue(0);

  return (
    <GestureHandlerRootView style={{ height: groups.length * rowHeight }}>
      {groups.map((group, index) => (
        <ReorderRow
          key={group.id}
          colors={colors}
          disabled={disabled}
          dragIndex={dragIndex}
          dragOffset={dragOffset}
          group={group}
          index={index}
          length={groups.length}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          onReorder={onReorder}
        />
      ))}
    </GestureHandlerRootView>
  );
}

function ReorderRow({
  colors,
  disabled,
  dragIndex,
  dragOffset,
  group,
  index,
  length,
  onDragEnd,
  onDragStart,
  onReorder,
}: {
  colors: ReturnType<typeof useAppColors>;
  disabled: boolean;
  dragIndex: SharedValue<number>;
  dragOffset: SharedValue<number>;
  group: BudgetGroup;
  index: number;
  length: number;
  onDragEnd?: () => void;
  onDragStart?: () => void;
  onReorder: (from: number, to: number) => void;
}) {
  function finishDrag(from: number, offset: number) {
    const to = Math.max(
      0,
      Math.min(length - 1, Math.round((from * rowHeight + offset) / rowHeight)),
    );
    dragIndex.value = -1;
    dragOffset.value = 0;
    onDragEnd?.();
    if (from !== to) onReorder(from, to);
  }

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(140)
    .onStart(() => {
      dragIndex.value = index;
      dragOffset.value = 0;
      if (onDragStart) runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      dragOffset.value = event.translationY;
    })
    .onEnd((event) => {
      runOnJS(finishDrag)(index, event.translationY);
    });

  const style = useAnimatedStyle(() => {
    const resting = index * rowHeight;
    if (dragIndex.value === index) {
      return {
        transform: [{ translateY: resting + dragOffset.value }],
        zIndex: 2,
        shadowOpacity: 0.16,
        elevation: 4,
      };
    }
    let shift = 0;
    if (dragIndex.value !== -1) {
      const from = dragIndex.value;
      const to = Math.max(
        0,
        Math.min(
          length - 1,
          Math.round((from * rowHeight + dragOffset.value) / rowHeight),
        ),
      );
      if (from < to && index > from && index <= to) shift = -rowHeight;
      if (from > to && index >= to && index < from) shift = rowHeight;
    }
    return {
      transform: [{ translateY: withTiming(resting + shift, { duration: 160 }) }],
      zIndex: 0,
      shadowOpacity: 0,
      elevation: 0,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessibilityLabel={`Drag to reorder ${group.title}`}
        accessibilityRole="adjustable"
        style={[
          styles.row,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            shadowColor: colors.text,
          },
          style,
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>{group.title}</Text>
        <SymbolView
          fallback={<Text style={{ color: colors.secondaryText }}>≡</Text>}
          name="line.3.horizontal"
          size={16}
          tintColor={colors.secondaryText}
          weight="semibold"
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    height: rowHeight - spacing.xs,
    justifyContent: "space-between",
    left: 0,
    paddingHorizontal: spacing.md,
    position: "absolute",
    right: 0,
    top: 0,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  title: typography.headline,
});

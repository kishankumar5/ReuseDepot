import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from "../constants/theme";
import { Category } from "../types";

interface Props {
  category: Category;
  onPress: (category: Category) => void;
  onLongPress?: (category: Category) => void;
  count?: number;
  disabled?: boolean;
}

export default function CategoryButton({
  category,
  onPress,
  onLongPress,
  count = 0,
  disabled = false,
}: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && { opacity: 0.3 }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(category);
      }}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        onLongPress?.(category);
      }}
      delayLongPress={400}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <Text style={styles.name} numberOfLines={2}>
        {category.name}
      </Text>
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
      {onLongPress && (
        <Text style={styles.hint}>Hold to add note</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    margin: SPACING.xs,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 96,
    position: "relative",
  },
  name: {
    color: COLORS.white,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  badge: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.red,
    borderRadius: RADIUS.full,
    minWidth: 24,
    height: 24,
    paddingHorizontal: SPACING.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
  },
  hint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    position: "absolute",
    bottom: SPACING.sm,
  },
});
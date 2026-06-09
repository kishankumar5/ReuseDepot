import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from "../constants/theme";

interface Props {
  label: string;
  value: number | string;
  color?: string;
}

export default function StatCard({ label, value, color }: Props) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.xs,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  value: {
    fontSize: FONT_SIZE.heading,
    fontWeight: FONT_WEIGHT.black,
    color: COLORS.textPrimary,
  },
  label: {
    fontSize: FONT_SIZE.caption,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.semibold,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: SPACING.xs,
  },
});
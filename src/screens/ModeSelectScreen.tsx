import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from "../constants/theme";

interface Props {
  coordinatorName: string;
  onSelectDrive: () => void;
  onSelectDepot: () => void;
  onLogout: () => void;
}

export default function ModeSelectScreen({ coordinatorName, onSelectDrive, onSelectDepot, onLogout }: Props) {
  const { width } = useWindowDimensions();
  const isIPad = width >= 768;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandMark}><Text style={styles.brandN}>N</Text></View>
          <TouchableOpacity onPress={onLogout}><Text style={styles.logoutText}>Log out</Text></TouchableOpacity>
        </View>
        <Text style={styles.greeting}>Hi, {coordinatorName}</Text>
        <Text style={[styles.title, isIPad && { fontSize: 40 }]}>ReuseScan</Text>
      </View>

      <View style={[styles.content, isIPad && styles.contentIPad]}>
        <Text style={styles.sectionLabel}>SELECT MODE</Text>

        <TouchableOpacity style={[styles.modeCard, isIPad && styles.modeCardIPad]} onPress={onSelectDrive} activeOpacity={0.8}>
          <View style={[styles.modeIcon, isIPad && styles.modeIconIPad]}><Text style={[styles.modeEmoji, isIPad && { fontSize: 32 }]}>📦</Text></View>
          <View style={styles.modeInfo}>
            <Text style={[styles.modeTitle, isIPad && { fontSize: FONT_SIZE.heading }]}>Drive Mode</Text>
            <Text style={[styles.modeDesc, isIPad && { fontSize: FONT_SIZE.body }]}>Move-out week donation collection at POD stations across campus</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.modeCard, styles.modeCardRed, isIPad && styles.modeCardIPad]} onPress={onSelectDepot} activeOpacity={0.8}>
          <View style={[styles.modeIcon, isIPad && styles.modeIconIPad, { backgroundColor: "rgba(255,255,255,0.15)" }]}><Text style={[styles.modeEmoji, isIPad && { fontSize: 32 }]}>🏪</Text></View>
          <View style={styles.modeInfo}>
            <Text style={[styles.modeTitle, { color: COLORS.white }, isIPad && { fontSize: FONT_SIZE.heading }]}>Depot Mode</Text>
            <Text style={[styles.modeDesc, { color: "rgba(255,255,255,0.7)" }, isIPad && { fontSize: FONT_SIZE.body }]}>Year-round Reuse Depot — receive donations and manage student checkouts</Text>
          </View>
          <Text style={[styles.arrow, { color: COLORS.white }]}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { paddingHorizontal: SPACING.xl, paddingTop: 64, paddingBottom: SPACING.xl, backgroundColor: COLORS.black },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.xl },
  brandMark: { width: 32, height: 32, backgroundColor: COLORS.red, alignItems: "center", justifyContent: "center" },
  brandN: { color: COLORS.white, fontSize: 18, fontWeight: FONT_WEIGHT.black, fontStyle: "italic" },
  logoutText: { color: COLORS.textLight, fontSize: FONT_SIZE.small },
  greeting: { color: COLORS.textLight, fontSize: FONT_SIZE.body, marginBottom: SPACING.xs },
  title: { color: COLORS.white, fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.black },
  content: { padding: SPACING.xl },
  contentIPad: { maxWidth: 640, width: "100%", alignSelf: "center", paddingTop: SPACING.xxxl },
  modeCardIPad: { padding: SPACING.xxl, marginBottom: SPACING.xl },
  modeIconIPad: { width: 64, height: 64, marginRight: SPACING.xl },
  sectionLabel: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: COLORS.red, letterSpacing: 2.5, marginBottom: SPACING.xl },
  modeCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.divider, padding: SPACING.xl, marginBottom: SPACING.lg,
  },
  modeCardRed: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  modeIcon: {
    width: 48, height: 48, backgroundColor: COLORS.backgroundAlt,
    alignItems: "center", justifyContent: "center", marginRight: SPACING.lg,
  },
  modeEmoji: { fontSize: 24 },
  modeInfo: { flex: 1 },
  modeTitle: { fontSize: FONT_SIZE.large, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  modeDesc: { fontSize: FONT_SIZE.small, color: COLORS.textSecondary, lineHeight: 18 },
  arrow: { fontSize: FONT_SIZE.title, color: COLORS.red, marginLeft: SPACING.md },
});

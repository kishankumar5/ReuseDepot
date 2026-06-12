import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { supabase } from "../lib/supabase";
import { DepotInventory } from "../types";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from "../constants/theme";

interface Props {
  onReceive: () => void;
  onKiosk: () => void;
  onBack: () => void;
}

export default function DepotHomeScreen({ onReceive, onKiosk, onBack }: Props) {
  const [inventory, setInventory] = useState<DepotInventory[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchInventory(); }, []);

  const fetchInventory = async () => {
    const { data } = await supabase.from("depot_inventory").select("*");
    if (data) setInventory(data.filter((i) => i.in_stock > 0 || i.total_in > 0));
  };

  const onRefresh = async () => { setRefreshing(true); await fetchInventory(); setRefreshing(false); };
  const totalStock = inventory.reduce((s, i) => s + Math.max(0, i.in_stock), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Reuse Depot</Text>
        <Text style={styles.subtitle}>{totalStock} items in stock</Text>
      </View>

      <TouchableOpacity style={styles.receiveBanner} onPress={onReceive} activeOpacity={0.85}>
        <Text style={styles.receiveEmoji}>📥</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.receiveTitle}>Receive Donation</Text>
          <Text style={styles.receiveDesc}>Log incoming donations from visitors</Text>
        </View>
        <Text style={styles.receiveArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.kioskBanner} onPress={onKiosk} activeOpacity={0.85}>
        <Text style={styles.kioskEmoji}>♻️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.kioskTitle}>Open Kiosk Mode</Text>
          <Text style={styles.kioskDesc}>Hand the iPad to a visitor to log items themselves</Text>
        </View>
        <Text style={styles.kioskArrow}>→</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.stockList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Text style={styles.sectionLabel}>CURRENT STOCK</Text>
        {inventory.length === 0 ? (
          <Text style={styles.empty}>No items in the depot yet.</Text>
        ) : (
          inventory.map((item) => (
            <View key={item.category_id} style={styles.stockRow}>
              <View style={styles.stockInfo}>
                <Text style={styles.stockName}>{item.category_name}</Text>
                <Text style={styles.stockMeta}>{item.total_in} in · {item.total_out} out</Text>
              </View>
              <View style={[styles.stockBadge, item.in_stock <= 0 && { backgroundColor: COLORS.divider }]}>
                <Text style={[styles.stockCount, item.in_stock <= 0 && { color: COLORS.textLight }]}>
                  {Math.max(0, item.in_stock)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { paddingHorizontal: SPACING.xl, paddingTop: 64, paddingBottom: SPACING.xl, backgroundColor: COLORS.black },
  back: { color: COLORS.red, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.md },
  title: { color: COLORS.white, fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.black },
  subtitle: { color: COLORS.textLight, fontSize: FONT_SIZE.body, marginTop: SPACING.xs },
  receiveBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.lg,
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl, marginBottom: SPACING.md,
    backgroundColor: "#EBF0FF", borderRadius: 8,
    padding: SPACING.xl, borderWidth: 1, borderColor: "#C5D0F5",
  },
  receiveEmoji: { fontSize: 28 },
  receiveTitle: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: "#2D4E8C" },
  receiveDesc: { fontSize: FONT_SIZE.small, color: "#4A5A7A", marginTop: 2 },
  receiveArrow: { fontSize: FONT_SIZE.large, color: "#2D4E8C", fontWeight: FONT_WEIGHT.bold },
  stockList: { paddingHorizontal: SPACING.xl, paddingBottom: 100 },
  sectionLabel: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: COLORS.red, letterSpacing: 2.5, marginBottom: SPACING.lg },
  stockRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  stockInfo: { flex: 1 },
  stockName: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary },
  stockMeta: { fontSize: FONT_SIZE.small, color: COLORS.textSecondary, marginTop: 2 },
  stockBadge: {
    backgroundColor: COLORS.black, minWidth: 40, height: 32,
    alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.sm,
  },
  stockCount: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.black },
  empty: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, textAlign: "center", paddingVertical: SPACING.xxl },
  kioskBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.lg,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.xl,
    backgroundColor: "#EBF5EE", borderRadius: 8,
    padding: SPACING.xl, borderWidth: 1, borderColor: "#C5E8CF",
  },
  kioskEmoji: { fontSize: 28 },
  kioskTitle: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: "#2D8C4E" },
  kioskDesc: { fontSize: FONT_SIZE.small, color: "#4A7A5A", marginTop: 2 },
  kioskArrow: { fontSize: FONT_SIZE.large, color: "#2D8C4E", fontWeight: FONT_WEIGHT.bold },
});

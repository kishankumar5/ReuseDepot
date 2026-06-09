import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView } from "react-native";
import { supabase } from "../lib/supabase";
import { Location } from "../types";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, SHADOWS } from "../constants/theme";

interface DonationItem {
  id: string; item_description: string | null; quantity: number; created_at: string;
  category: { name: string }; location: { name: string }; coordinator: { name: string }; pod: { pod_number: string } | null;
}

interface Props { locations: Location[]; currentLocation: Location; onBack: () => void; }

export default function InventoryScreen({ locations, currentLocation, onBack }: Props) {
  const [donations, setDonations] = useState<DonationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locFilter, setLocFilter] = useState<string | "all">(currentLocation.id);
  const [catFilter, setCatFilter] = useState<string | "all">("all");
  const [podFilter, setPodFilter] = useState<string | "all">("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [pods, setPods] = useState<string[]>([]);
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});
  const [podCounts, setPodCounts] = useState<Record<string, number>>({});

  useEffect(() => { fetch(); }, [locFilter]);

  const fetch = async () => {
    let q = supabase.from("donations").select(`id, item_description, quantity, created_at,
      category:categories(name), location:locations(name), coordinator:coordinators(name), pod:pods(pod_number)`)
      .eq("is_accepted", true).order("created_at", { ascending: false }).limit(200);
    if (locFilter !== "all") q = q.eq("location_id", locFilter);
    const { data } = await q;
    if (data) {
      const items = data.map((d: any) => ({
        ...d, category: d.category || { name: "Unknown" }, location: d.location || { name: "Unknown" },
        coordinator: d.coordinator || { name: "Unknown" }, pod: d.pod || null,
      }));
      setDonations(items);
      const cc: Record<string, number> = {}; const pc: Record<string, number> = {};
      items.forEach((d: any) => { cc[d.category.name] = (cc[d.category.name] || 0) + (d.quantity || 1); });
      items.filter((d: any) => d.pod).forEach((d: any) => { pc[d.pod.pod_number] = (pc[d.pod.pod_number] || 0) + (d.quantity || 1); });
      setCatCounts(cc); setPodCounts(pc);
      setCategories(Object.keys(cc).sort()); setPods(Object.keys(pc).sort());
    }
    setLoading(false);
  };

  const onRefresh = useCallback(async () => { setRefreshing(true); await fetch(); setRefreshing(false); }, [locFilter]);
  const filtered = donations.filter((d) => {
    if (catFilter !== "all" && d.category.name !== catFilter) return false;
    if (podFilter !== "all" && d.pod?.pod_number !== podFilter) return false;
    return true;
  });

  const fmt = (s: string) => new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator color={COLORS.red} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.subtitle}>{filtered.length} item{filtered.length !== 1 ? "s" : ""}</Text>
      </View>

      <View style={styles.filterBlock}>
        <Text style={styles.filterLabel}>LOCATION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="All Sites" active={locFilter === "all"} onPress={() => setLocFilter("all")} />
          {locations.map((l) => <Chip key={l.id} label={l.name} active={locFilter === l.id} onPress={() => setLocFilter(l.id)} />)}
        </ScrollView>
      </View>

      {categories.length > 0 && (
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label={`All (${donations.length})`} active={catFilter === "all"} onPress={() => setCatFilter("all")} />
            {categories.map((c) => <Chip key={c} label={`${c} (${catCounts[c] || 0})`} active={catFilter === c} onPress={() => setCatFilter(c)} />)}
          </ScrollView>
        </View>
      )}

      {pods.length > 0 && (
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>POD</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label="All" active={podFilter === "all"} onPress={() => setPodFilter("all")} />
            {pods.map((p) => <Chip key={p} label={`${p} (${podCounts[p] || 0})`} active={podFilter === p} onPress={() => setPodFilter(p)} />)}
          </ScrollView>
        </View>
      )}

      <FlatList data={filtered} keyExtractor={(i) => i.id} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemTop}>
              <Text style={styles.itemCat}>{item.category.name}</Text>
              {item.quantity > 1 && <Text style={styles.itemQty}>×{item.quantity}</Text>}
            </View>
            {item.item_description && <Text style={styles.itemDesc}>{item.item_description}</Text>}
            <Text style={styles.itemMeta}>
              {item.pod ? `${item.pod.pod_number} · ` : ""}{item.location.name} · {item.coordinator.name} · {fmt(item.created_at)}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No items logged yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  center: { justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: SPACING.xl, paddingTop: 64, paddingBottom: SPACING.lg, backgroundColor: COLORS.black },
  back: { color: COLORS.red, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.md },
  title: { color: COLORS.white, fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.black },
  subtitle: { color: COLORS.textLight, fontSize: FONT_SIZE.body, marginTop: SPACING.xs },
  filterBlock: { paddingLeft: SPACING.xl, marginTop: SPACING.lg },
  filterLabel: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: COLORS.red, letterSpacing: 2, marginBottom: SPACING.sm },
  chipRow: { paddingRight: SPACING.xl, gap: SPACING.sm },
  chip: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, borderWidth: 1, borderColor: COLORS.divider, backgroundColor: COLORS.white },
  chipActive: { backgroundColor: COLORS.black, borderColor: COLORS.black },
  chipText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  itemCard: { borderBottomWidth: 1, borderBottomColor: COLORS.divider, paddingVertical: SPACING.lg },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemCat: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  itemQty: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: COLORS.red },
  itemDesc: { fontSize: FONT_SIZE.body, color: COLORS.textPrimary, marginTop: SPACING.sm },
  itemMeta: { fontSize: FONT_SIZE.small, color: COLORS.textSecondary, marginTop: SPACING.sm },
  empty: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, paddingVertical: SPACING.xxl, textAlign: "center" },
});
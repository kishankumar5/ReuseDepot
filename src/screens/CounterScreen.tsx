import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { supabase } from "../lib/supabase";
import { Location, DonationSummary, LocationTotal } from "../types";
import StatCard from "../components/StatCard";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from "../constants/theme";

interface Props { location: Location; onBack: () => void; }

export default function CounterScreen({ location, onBack }: Props) {
  const [summary, setSummary] = useState<DonationSummary[]>([]);
  const [allTotals, setAllTotals] = useState<LocationTotal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayDonors, setTodayDonors] = useState(0);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const today = new Date().toISOString().split("T")[0];
    const [s, t, d] = await Promise.all([
      supabase.from("donation_summary").select("*").eq("location_name", location.name),
      supabase.from("location_totals").select("*"),
      supabase.from("donations").select("id, quantity").eq("location_id", location.id).eq("is_accepted", true).gte("created_at", `${today}T00:00:00`),
    ]);
    if (s.data) setSummary(s.data);
    if (t.data) setAllTotals(t.data);
    if (d.data) { setTodayTotal(d.data.reduce((s, i) => s + (i.quantity || 1), 0)); setTodayDonors(d.data.length); }
  };

  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); }, []);
  const grandTotal = allTotals.reduce((s, l) => s + (l.total_items || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Live Counter</Text>
        <Text style={styles.subtitle}>{location.name}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.statRow}>
          <StatCard label="Items" value={todayTotal} color={COLORS.red} />
          <StatCard label="Donors" value={todayDonors} color={COLORS.black} />
          <StatCard label="All Sites" value={grandTotal} color={COLORS.success} />
        </View>

        <Text style={styles.section}>BY CATEGORY</Text>
        {summary.length === 0 ? <Text style={styles.empty}>No donations yet.</Text> :
          summary.map((item) => (
            <View key={item.category_name} style={styles.row}>
              <View style={styles.dot} />
              <Text style={styles.rowName}>{item.category_name}</Text>
              <Text style={styles.rowCount}>{item.total_quantity}</Text>
            </View>
          ))}

        <Text style={[styles.section, { marginTop: SPACING.xxl }]}>ALL LOCATIONS</Text>
        {allTotals.map((loc) => (
          <View key={loc.location_id} style={[styles.row, loc.location_name === location.name && { borderLeftWidth: 3, borderLeftColor: COLORS.red }]}>
            <Text style={[styles.rowName, loc.location_name === location.name && { fontWeight: FONT_WEIGHT.bold }]}>
              {loc.location_name}{loc.location_name === location.name ? " (you)" : ""}
            </Text>
            <Text style={styles.rowCount}>{loc.total_items || 0}</Text>
          </View>
        ))}
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
  content: { padding: SPACING.xl, paddingBottom: 100 },
  statRow: { flexDirection: "row", marginBottom: SPACING.xxl },
  section: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: COLORS.red, letterSpacing: 2, marginBottom: SPACING.md },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  dot: { width: 8, height: 8, backgroundColor: COLORS.red, borderRadius: 4, marginRight: SPACING.md },
  rowName: { flex: 1, fontSize: FONT_SIZE.body, color: COLORS.textPrimary },
  rowCount: { fontSize: FONT_SIZE.large, fontWeight: FONT_WEIGHT.black, color: COLORS.textPrimary },
  empty: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, paddingVertical: SPACING.xxl, textAlign: "center" },
});
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Modal, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Keyboard,
  Alert, ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";
import { Category, Donation } from "../types";
import CategoryButton from "../components/CategoryButton";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, SHADOWS } from "../constants/theme";

interface Props {
  coordinatorId: string;
  locationId: string;
  onBack: () => void;
}

export default function DepotReceiveScreen({ coordinatorId, locationId, onBack }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [todayTotal, setTodayTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [itemNote, setItemNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [lastDonationId, setLastDonationId] = useState<string | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchCategories(); fetchTodayCounts(); }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("*").eq("is_accepted", true).order("sort_order");
    if (data) setCategories(data);
    setLoading(false);
  };

  const fetchTodayCounts = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("donations").select("category_id, quantity")
      .eq("location_id", locationId).eq("is_accepted", true).gte("created_at", `${today}T00:00:00`);
    if (data) {
      const counts: Record<string, number> = {};
      let total = 0;
      data.forEach((d) => { counts[d.category_id] = (counts[d.category_id] || 0) + (d.quantity || 1); total += d.quantity || 1; });
      setCategoryCounts(counts);
      setTodayTotal(total);
    }
  };

  useEffect(() => {
    const channel = supabase.channel(`depot-donations`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "donations", filter: `location_id=eq.${locationId}` },
        (payload) => {
          const d = payload.new as Donation;
          if (d.is_accepted) {
            setCategoryCounts((prev) => ({ ...prev, [d.category_id]: (prev[d.category_id] || 0) + (d.quantity || 1) }));
            setTodayTotal((prev) => prev + (d.quantity || 1));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [locationId]);

  const handleCategoryPress = async (category: Category) => {
    const { data, error } = await supabase.from("donations")
      .insert({ category_id: category.id, location_id: locationId, coordinator_id: coordinatorId, quantity: 1, is_accepted: true })
      .select("id").single();
    if (error) { Alert.alert("Error", "Failed to log."); return; }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLastDonationId(data.id);
    setFlashMessage(`✓ ${category.name}`);
    if (undoTimeout) clearTimeout(undoTimeout);
    setUndoTimeout(setTimeout(() => { setFlashMessage(null); setLastDonationId(null); }, 4000));
  };

  const handleCategoryLongPress = (category: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelectedCategory(category);
    setItemNote("");
  };

  const handleUndo = async () => {
    if (!lastDonationId) return;
    await supabase.from("donations").delete().eq("id", lastDonationId);
    setFlashMessage(null); setLastDonationId(null);
    if (undoTimeout) clearTimeout(undoTimeout);
    fetchTodayCounts();
  };

  const handleSubmit = async () => {
    if (!selectedCategory) return;
    setSubmitting(true);
    const { error } = await supabase.from("donations").insert({
      category_id: selectedCategory.id, location_id: locationId, coordinator_id: coordinatorId,
      item_description: itemNote.trim() || null, quantity: 1, is_accepted: true,
    });
    if (error) Alert.alert("Error", "Failed to log.");
    else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setFlashMessage(`✓ ${selectedCategory.name}`); setTimeout(() => setFlashMessage(null), 2000); }
    setSubmitting(false); setSelectedCategory(null); setItemNote("");
  };

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator color={COLORS.red} /></View>;

  return (
    <View style={styles.container}>
      {flashMessage && (
        <View style={styles.toastWrap}>
          <View style={styles.toast}>
            <Text style={styles.toastText}>{flashMessage}</Text>
            {lastDonationId && (
              <TouchableOpacity onPress={handleUndo} style={styles.undoBtn}>
                <Text style={styles.undoText}>UNDO</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.header}>
        <View>
          <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Depot</Text></TouchableOpacity>
          <Text style={styles.title}>Receive Donations</Text>
        </View>
        <View style={styles.counterPill}>
          <Text style={styles.counterNum}>{todayTotal}</Text>
          <Text style={styles.counterLabel}>TODAY</Text>
        </View>
      </View>

      <FlatList
        data={categories}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <CategoryButton category={item} onPress={handleCategoryPress} onLongPress={handleCategoryLongPress}
            count={categoryCounts[item.id] || 0} />
        )}
      />

      <Modal visible={selectedCategory !== null} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Add a note</Text>
                <View style={styles.modalTag}><Text style={styles.modalTagText}>{selectedCategory?.name}</Text></View>
                <TextInput style={styles.modalInput} placeholder="e.g. 'blue Nike jacket', 'set of 4 plates'"
                  placeholderTextColor={COLORS.textLight} value={itemNote} onChangeText={setItemNote}
                  returnKeyType="done" blurOnSubmit onSubmitEditing={Keyboard.dismiss} autoFocus />
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => { setSelectedCategory(null); setItemNote(""); }}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirm} onPress={handleSubmit} disabled={submitting}>
                    {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.modalConfirmText}>Log it →</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundAlt },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: SPACING.xl, paddingTop: 64, paddingBottom: SPACING.xl, backgroundColor: COLORS.black,
  },
  back: { color: COLORS.red, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.md },
  title: { color: COLORS.white, fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.black },
  counterPill: { backgroundColor: COLORS.red, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, alignItems: "center" },
  counterNum: { fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.black, color: COLORS.white },
  counterLabel: { fontSize: FONT_SIZE.caption, color: "rgba(255,255,255,0.7)", fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1 },
  grid: { padding: SPACING.lg, paddingBottom: 100 },
  toastWrap: { position: "absolute", top: 56, left: 0, right: 0, zIndex: 100, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.black, paddingVertical: SPACING.md, paddingLeft: SPACING.xl, paddingRight: SPACING.md, gap: SPACING.md, ...SHADOWS.card },
  toastText: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  undoBtn: { backgroundColor: COLORS.red, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md },
  undoText: { color: COLORS.white, fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: COLORS.white, padding: SPACING.xl, paddingBottom: 44 },
  modalTitle: { fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.black, color: COLORS.textPrimary, marginBottom: SPACING.md },
  modalTag: { alignSelf: "flex-start", backgroundColor: COLORS.black, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl },
  modalTagText: { color: COLORS.white, fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold },
  modalInput: { borderBottomWidth: 1, borderBottomColor: COLORS.divider, fontSize: FONT_SIZE.body, color: COLORS.textPrimary, paddingVertical: SPACING.md, marginBottom: SPACING.xl },
  modalBtns: { flexDirection: "row", gap: SPACING.md },
  modalCancel: { flex: 1, height: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.divider },
  modalCancelText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  modalConfirm: { flex: 1, height: 48, backgroundColor: COLORS.red, alignItems: "center", justifyContent: "center" },
  modalConfirmText: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
});

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Modal, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Keyboard,
  Alert, ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";
import { Category, Location, Donation, Pod } from "../types";
import CategoryButton from "../components/CategoryButton";
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS } from "../constants/theme";

interface Props {
  location: Location;
  coordinatorId: string;
  onChangeLocation: () => void;
  onViewCounter: () => void;
  onViewInventory: () => void;
}

export default function QuickLogScreen({ location, coordinatorId, onChangeLocation, onViewCounter, onViewInventory }: Props) {
  const [acceptedCategories, setAcceptedCategories] = useState<Category[]>([]);
  const [rejectedCategories, setRejectedCategories] = useState<Category[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [todayTotal, setTodayTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [activePod, setActivePod] = useState<Pod | null>(null);
  const [allPods, setAllPods] = useState<Pod[]>([]);
  const [showPodSwitchModal, setShowPodSwitchModal] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [itemNote, setItemNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [lastDonationId, setLastDonationId] = useState<string | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchTodayCounts();
    fetchPods();
  }, []);

  const fetchPods = async () => {
    const { data } = await supabase.from("pods").select("*").eq("location_id", location.id).order("pod_type");
    if (data) {
      setAllPods(data);
      setActivePod(data.find((p) => p.pod_type === "receiving" && p.status !== "full" && p.status !== "closed") || data.find((p) => p.status !== "full") || null);
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    if (data) {
      setAcceptedCategories(data.filter((c) => c.is_accepted));
      setRejectedCategories(data.filter((c) => !c.is_accepted));
    }
    setLoading(false);
  };

  const fetchTodayCounts = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("donations").select("category_id, quantity").eq("location_id", location.id).eq("is_accepted", true).gte("created_at", `${today}T00:00:00`);
    if (data) {
      const counts: Record<string, number> = {};
      let total = 0;
      data.forEach((d) => { counts[d.category_id] = (counts[d.category_id] || 0) + (d.quantity || 1); total += d.quantity || 1; });
      setCategoryCounts(counts);
      setTodayTotal(total);
    }
  };

  useEffect(() => {
    const channel = supabase.channel(`donations-${location.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "donations", filter: `location_id=eq.${location.id}` },
        (payload) => {
          const d = payload.new as Donation;
          if (d.is_accepted) {
            setCategoryCounts((prev) => ({ ...prev, [d.category_id]: (prev[d.category_id] || 0) + (d.quantity || 1) }));
            setTodayTotal((prev) => prev + (d.quantity || 1));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [location.id]);

  const noPodAvailable = !activePod || activePod.status === "full";

  // QUICK TAP → instant log
  const handleCategoryPress = async (category: Category) => {
    if (noPodAvailable) {
      Alert.alert("No Active POD", "All PODs are full here. Contact Morgan or switch location.",
        [{ text: "OK" }, { text: "Switch", onPress: onChangeLocation }]);
      return;
    }

    const { data, error } = await supabase.from("donations")
      .insert({ category_id: category.id, location_id: location.id, coordinator_id: coordinatorId, pod_id: activePod?.id || null, quantity: 1, is_accepted: true })
      .select("id").single();

    if (error) { Alert.alert("Error", "Failed to log."); return; }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLastDonationId(data.id);
    setFlashMessage(`✓ ${category.name}`);
    if (undoTimeout) clearTimeout(undoTimeout);
    setUndoTimeout(setTimeout(() => { setFlashMessage(null); setLastDonationId(null); }, 4000));
  };

  // LONG PRESS → notes modal
  const handleCategoryLongPress = (category: Category) => {
    if (noPodAvailable) { handleCategoryPress(category); return; }
    setSelectedCategory(category);
    setItemNote("");
  };

  // UNDO
  const handleUndo = async () => {
    if (!lastDonationId) return;
    await supabase.from("donations").delete().eq("id", lastDonationId);
    setFlashMessage(null); setLastDonationId(null);
    if (undoTimeout) clearTimeout(undoTimeout);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    fetchTodayCounts();
  };

  // SUBMIT WITH NOTES
  const handleSubmitDonation = async () => {
    if (!selectedCategory) return;
    setSubmitting(true);
    const { error } = await supabase.from("donations").insert({
      category_id: selectedCategory.id, location_id: location.id, coordinator_id: coordinatorId,
      pod_id: activePod?.id || null, item_description: itemNote.trim() || null, quantity: 1,
      is_accepted: selectedCategory.is_accepted,
      rejection_reason: !selectedCategory.is_accepted ? `Item: ${selectedCategory.name}` : null,
    });
    if (error) { Alert.alert("Error", "Failed to log."); }
    else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setFlashMessage(`✓ ${selectedCategory.name}`); setTimeout(() => setFlashMessage(null), 2000); }
    setSubmitting(false); setSelectedCategory(null); setItemNote("");
  };

  const handleMarkPodFull = async () => {
    if (!activePod) return;
    const nextPod = allPods.find((p) => p.id !== activePod.id && p.status !== "full" && p.status !== "closed");
    if (!nextPod) {
      Alert.alert("Last POD", `No more PODs at ${location.name}. Contact Morgan.`,
        [{ text: "Cancel", style: "cancel" }, { text: "Mark Full", style: "destructive", onPress: async () => {
          await supabase.from("pods").update({ status: "full", updated_at: new Date().toISOString() }).eq("id", activePod.id);
          await fetchPods(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }}]);
      setShowPodSwitchModal(false); return;
    }
    await supabase.from("pods").update({ status: "full", updated_at: new Date().toISOString() }).eq("id", activePod.id);
    await supabase.from("pods").update({ pod_type: "receiving", status: "active", updated_at: new Date().toISOString() }).eq("id", nextPod.id);
    await fetchPods(); setShowPodSwitchModal(false);
    Alert.alert("Switched", `Now receiving at ${nextPod.pod_number}.`);
  };

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator color={COLORS.red} /></View>;

  return (
    <View style={styles.container}>
      {/* Toast */}
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

      {/* Header */}
      <View style={styles.header}>
        <View>
          <TouchableOpacity onPress={onChangeLocation}>
            <Text style={styles.locationLabel}>📍 {location.name} ▾</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Log Donation</Text>
        </View>
        <TouchableOpacity onPress={onViewCounter} style={styles.counterPill}>
          <Text style={styles.counterNum}>{todayTotal}</Text>
          <Text style={styles.counterLabel}>today</Text>
        </TouchableOpacity>
      </View>

      {/* POD Bar */}
      {activePod ? (
        <View style={styles.podBar}>
          <View style={styles.podInfo}>
            <Text style={styles.podNum}>📦 {activePod.pod_number}</Text>
            <View style={[styles.podBadge, activePod.status === "filling" && { backgroundColor: COLORS.warning }]}>
              <Text style={styles.podBadgeText}>{activePod.status === "active" ? "RECEIVING" : activePod.status.toUpperCase()}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowPodSwitchModal(true)}>
            <Text style={styles.podFullLink}>Mark full →</Text>
          </TouchableOpacity>
        </View>
      ) : allPods.length > 0 ? (
        <View style={[styles.podBar, { borderColor: COLORS.red }]}>
          <Text style={[styles.podNum, { color: COLORS.red }]}>⚠ All PODs full</Text>
          <Text style={styles.podFullLink}>Contact Morgan</Text>
        </View>
      ) : null}

      {/* Grid */}
      <FlatList
        data={acceptedCategories}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <CategoryButton category={item} onPress={handleCategoryPress} onLongPress={handleCategoryLongPress}
            count={categoryCounts[item.id] || 0} disabled={noPodAvailable} />
        )}
        ListFooterComponent={
          <View>
            <TouchableOpacity style={styles.actionBtn} onPress={onViewInventory}>
              <Text style={styles.actionBtnText}>View inventory →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => setShowRejectModal(true)}>
              <Text style={styles.rejectBtnText}>Can't accept this item</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Notes Modal */}
      <Modal visible={selectedCategory !== null && !showRejectModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Add a note</Text>
                <View style={styles.modalTag}><Text style={styles.modalTagText}>{selectedCategory?.name}</Text></View>
                <TextInput style={styles.modalInput} placeholder="e.g. 'red kettle', '3 t-shirts'" placeholderTextColor={COLORS.textLight}
                  value={itemNote} onChangeText={setItemNote} returnKeyType="done" blurOnSubmit onSubmitEditing={Keyboard.dismiss} autoFocus />
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => { setSelectedCategory(null); setItemNote(""); }}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirm} onPress={handleSubmitDonation} disabled={submitting}>
                    {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.modalConfirmText}>Log it →</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={showRejectModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>What was rejected?</Text>
            <Text style={styles.modalHint}>Still logged for data tracking.</Text>
            {rejectedCategories.map((cat) => (
              <TouchableOpacity key={cat.id} style={styles.rejectOption}
                onPress={() => { setShowRejectModal(false); setSelectedCategory(cat); setItemNote(""); }}>
                <Text style={styles.rejectOptionText}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowRejectModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* POD Switch Modal */}
      <Modal visible={showPodSwitchModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Mark POD as full?</Text>
            <Text style={styles.modalHint}>
              {activePod?.pod_number} will be marked full. Move hampers to storage before confirming.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPodSwitchModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, { backgroundColor: COLORS.warning }]} onPress={handleMarkPodFull}>
                <Text style={styles.modalConfirmText}>Mark full</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  locationLabel: { fontSize: FONT_SIZE.small, color: COLORS.red, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.black, color: COLORS.white },
  counterPill: { backgroundColor: COLORS.red, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, alignItems: "center" },
  counterNum: { fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.black, color: COLORS.white },
  counterLabel: { fontSize: FONT_SIZE.caption, color: "rgba(255,255,255,0.7)", fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, textTransform: "uppercase" },
  // POD
  podBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: SPACING.xl, marginTop: SPACING.lg, paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, borderWidth: 1, borderColor: COLORS.divider, backgroundColor: COLORS.white },
  podInfo: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  podNum: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  podBadge: { backgroundColor: COLORS.success, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  podBadgeText: { color: COLORS.white, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5 },
  podFullLink: { fontSize: FONT_SIZE.small, color: COLORS.red, fontWeight: FONT_WEIGHT.semibold },
  // Grid
  grid: { padding: SPACING.lg, paddingBottom: 100 },
  actionBtn: { marginHorizontal: SPACING.xs, marginTop: SPACING.lg, paddingVertical: SPACING.lg, borderWidth: 1, borderColor: COLORS.black, alignItems: "center" },
  actionBtnText: { color: COLORS.black, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  rejectBtn: { marginHorizontal: SPACING.xs, marginTop: SPACING.md, paddingVertical: SPACING.lg, borderWidth: 1, borderColor: COLORS.red, borderStyle: "dashed", alignItems: "center" },
  rejectBtnText: { color: COLORS.red, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  // Toast
  toastWrap: { position: "absolute", top: 56, left: 0, right: 0, zIndex: 100, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.black, paddingVertical: SPACING.md, paddingLeft: SPACING.xl, paddingRight: SPACING.md, gap: SPACING.md, ...SHADOWS.card },
  toastText: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  undoBtn: { backgroundColor: COLORS.red, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md },
  undoText: { color: COLORS.white, fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: COLORS.white, padding: SPACING.xl, paddingBottom: 44 },
  modalTitle: { fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.black, color: COLORS.textPrimary, marginBottom: SPACING.md },
  modalHint: { fontSize: FONT_SIZE.body, color: COLORS.textSecondary, marginBottom: SPACING.xl, lineHeight: 22 },
  modalTag: { alignSelf: "flex-start", backgroundColor: COLORS.black, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl },
  modalTagText: { color: COLORS.white, fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold },
  modalInput: { borderBottomWidth: 1, borderBottomColor: COLORS.divider, fontSize: FONT_SIZE.body, color: COLORS.textPrimary, paddingVertical: SPACING.md, marginBottom: SPACING.xl },
  modalBtns: { flexDirection: "row", gap: SPACING.md },
  modalCancel: { flex: 1, height: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.divider },
  modalCancelText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  modalConfirm: { flex: 1, height: 48, backgroundColor: COLORS.red, alignItems: "center", justifyContent: "center" },
  modalConfirmText: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  rejectOption: { paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  rejectOptionText: { fontSize: FONT_SIZE.body, color: COLORS.red, fontWeight: FONT_WEIGHT.semibold },
});
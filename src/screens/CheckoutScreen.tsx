import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView, TouchableWithoutFeedback, Keyboard,
} from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";
import { Category, Visitor, DepotInventory } from "../types";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, SHADOWS } from "../constants/theme";

const MAX_ITEMS = 3;

const AFFILIATIONS = [
  { key: "student", label: "Student" },
  { key: "staff", label: "Staff" },
  { key: "faculty", label: "Faculty" },
  { key: "community", label: "Community" },
  { key: "other", label: "Other" },
] as const;

interface Props {
  coordinatorId: string;
  onBack: () => void;
}

type Step = "visitor" | "select" | "done";

export default function CheckoutScreen({ coordinatorId, onBack }: Props) {
  const [step, setStep] = useState<Step>("visitor");
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});

  // Visitor lookup
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<Visitor[]>([]);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [isNewVisitor, setIsNewVisitor] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAffiliation, setNewAffiliation] = useState<string>("student");

  // Cart
  const [cart, setCart] = useState<string[]>([]); // category IDs
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchInventory();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("*").eq("is_accepted", true).order("sort_order");
    if (data) setCategories(data);
  };

  const fetchInventory = async () => {
    const { data } = await supabase.from("depot_inventory").select("*");
    if (data) {
      const inv: Record<string, number> = {};
      data.forEach((d: DepotInventory) => { inv[d.category_id] = Math.max(0, d.in_stock); });
      setInventory(inv);
    }
  };

  // Visitor search
  const handleSearch = async (text: string) => {
    setSearchText(text);
    if (text.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from("visitors").select("*").ilike("name", `%${text}%`).limit(5);
    if (data) setSearchResults(data);
  };

  const selectVisitor = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setSearchText(visitor.name);
    setSearchResults([]);
    setStep("select");
  };

  const createAndSelectVisitor = async () => {
    if (!newName.trim()) { Alert.alert("Name required"); return; }
    const { data, error } = await supabase.from("visitors")
      .insert({ name: newName.trim(), affiliation: newAffiliation })
      .select().single();
    if (data) {
      setSelectedVisitor(data);
      setIsNewVisitor(false);
      setStep("select");
    }
    if (error) { Alert.alert("Error", error.message); }
  };

  // Cart management
  const toggleCategory = (categoryId: string) => {
    if (cart.includes(categoryId)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCart(cart.filter((id) => id !== categoryId));
    } else {
      if (cart.length >= MAX_ITEMS) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Limit Reached", `Maximum ${MAX_ITEMS} items per visit.`);
        return;
      }
      if ((inventory[categoryId] || 0) <= 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Out of Stock", "This category is currently unavailable.");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCart([...cart, categoryId]);
    }
  };

  const handleConfirmCheckout = async () => {
    if (!selectedVisitor || cart.length === 0) return;
    setSubmitting(true);

    const inserts = cart.map((catId) => ({
      visitor_id: selectedVisitor.id,
      category_id: catId,
      coordinator_id: coordinatorId,
      quantity: 1,
    }));

    const { error } = await supabase.from("checkouts").insert(inserts);

    if (error) {
      Alert.alert("Error", "Checkout failed. Try again.");
      console.error(error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("done");
    }
    setSubmitting(false);
  };

  const handleReset = () => {
    setStep("visitor");
    setSelectedVisitor(null);
    setSearchText("");
    setSearchResults([]);
    setCart([]);
    setIsNewVisitor(false);
    setNewName("");
    setNewAffiliation("student");
    fetchInventory();
  };

  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name || "Unknown";

  // =================== STEP: VISITOR LOOKUP ===================
  if (step === "visitor") {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack}><Text style={styles.back}>← Back</Text></TouchableOpacity>
            <Text style={styles.title}>Checkout</Text>
            <Text style={styles.subtitle}>Who's picking up items?</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.sectionLabel}>SEARCH BY NAME</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Start typing a name..."
              placeholderTextColor={COLORS.textLight}
              value={searchText}
              onChangeText={handleSearch}
              autoFocus
              autoCapitalize="words"
              returnKeyType="search"
            />

            {searchResults.map((v) => (
              <TouchableOpacity key={v.id} style={styles.resultRow} onPress={() => selectVisitor(v)}>
                <View>
                  <Text style={styles.resultName}>{v.name}</Text>
                  <Text style={styles.resultMeta}>{v.affiliation}</Text>
                </View>
                <Text style={styles.arrow}>→</Text>
              </TouchableOpacity>
            ))}

            {searchText.length >= 2 && searchResults.length === 0 && !isNewVisitor && (
              <TouchableOpacity style={styles.newVisitorBtn} onPress={() => { setIsNewVisitor(true); setNewName(searchText); }}>
                <Text style={styles.newVisitorText}>+ New visitor: "{searchText}"</Text>
              </TouchableOpacity>
            )}

            {isNewVisitor && (
              <View style={styles.newForm}>
                <Text style={styles.sectionLabel}>NEW VISITOR</Text>
                <TextInput style={styles.searchInput} placeholder="Full name" placeholderTextColor={COLORS.textLight}
                  value={newName} onChangeText={setNewName} autoCapitalize="words" />

                <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>AFFILIATION</Text>
                <View style={styles.affRow}>
                  {AFFILIATIONS.map((a) => (
                    <TouchableOpacity key={a.key}
                      style={[styles.affChip, newAffiliation === a.key && styles.affChipActive]}
                      onPress={() => setNewAffiliation(a.key)}>
                      <Text style={[styles.affText, newAffiliation === a.key && styles.affTextActive]}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.createBtn} onPress={createAndSelectVisitor}>
                  <Text style={styles.createBtnText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  // =================== STEP: SELECT ITEMS ===================
  if (step === "select") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep("visitor")}><Text style={styles.back}>← Change visitor</Text></TouchableOpacity>
          <Text style={styles.title}>{selectedVisitor?.name}</Text>
          <Text style={styles.subtitle}>{selectedVisitor?.affiliation} · {cart.length}/{MAX_ITEMS} items selected</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>TAP TO SELECT (MAX {MAX_ITEMS})</Text>

          <View style={styles.grid}>
            {categories.map((cat) => {
              const inCart = cart.includes(cat.id);
              const stock = inventory[cat.id] || 0;
              const outOfStock = stock <= 0;
              const locked = cart.length >= MAX_ITEMS && !inCart;

              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.itemBtn,
                    inCart && styles.itemBtnSelected,
                    (outOfStock || locked) && !inCart && { opacity: 0.3 },
                  ]}
                  onPress={() => toggleCategory(cat.id)}
                  disabled={(outOfStock || locked) && !inCart}
                  activeOpacity={0.8}
                >
                  {inCart && <View style={styles.checkMark}><Text style={styles.checkText}>✓</Text></View>}
                  <Text style={[styles.itemName, inCart && { color: COLORS.white }]}>{cat.name}</Text>
                  <Text style={[styles.itemStock, inCart && { color: "rgba(255,255,255,0.6)" }]}>
                    {outOfStock ? "Out of stock" : `${stock} available`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {cart.length > 0 && (
            <View style={styles.cartSummary}>
              <Text style={styles.sectionLabel}>SELECTED</Text>
              {cart.map((catId) => (
                <View key={catId} style={styles.cartRow}>
                  <Text style={styles.cartItem}>{getCategoryName(catId)}</Text>
                  <TouchableOpacity onPress={() => toggleCategory(catId)}>
                    <Text style={styles.cartRemove}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {cart.length > 0 && (
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmCheckout} disabled={submitting}>
              {submitting ? <ActivityIndicator color={COLORS.white} /> :
                <Text style={styles.confirmText}>Confirm checkout ({cart.length} item{cart.length > 1 ? "s" : ""}) →</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // =================== STEP: DONE ===================
  return (
    <View style={styles.container}>
      <View style={[styles.doneSection]}>
        <Text style={styles.doneEmoji}>✓</Text>
        <Text style={styles.doneTitle}>Checkout Complete</Text>
        <Text style={styles.doneName}>{selectedVisitor?.name}</Text>
        <View style={styles.doneItems}>
          {cart.map((catId) => (
            <Text key={catId} style={styles.doneItem}>{getCategoryName(catId)}</Text>
          ))}
        </View>
        <TouchableOpacity style={styles.nextBtn} onPress={handleReset}>
          <Text style={styles.nextBtnText}>Next student →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backToDepot} onPress={onBack}>
          <Text style={styles.backToDepotText}>Back to Depot</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { paddingHorizontal: SPACING.xl, paddingTop: 64, paddingBottom: SPACING.xl, backgroundColor: COLORS.black },
  back: { color: COLORS.red, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.md },
  title: { color: COLORS.white, fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.black },
  subtitle: { color: COLORS.textLight, fontSize: FONT_SIZE.body, marginTop: SPACING.xs },
  content: { padding: SPACING.xl, paddingBottom: 120 },
  sectionLabel: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: COLORS.red, letterSpacing: 2.5, marginBottom: SPACING.md },
  arrow: { fontSize: FONT_SIZE.title, color: COLORS.red },

  // Search
  searchInput: {
    borderBottomWidth: 2, borderBottomColor: COLORS.black, fontSize: FONT_SIZE.large,
    color: COLORS.textPrimary, paddingVertical: SPACING.md, marginBottom: SPACING.lg, fontWeight: FONT_WEIGHT.medium,
  },
  resultRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  resultName: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  resultMeta: { fontSize: FONT_SIZE.small, color: COLORS.textSecondary, marginTop: 2 },
  newVisitorBtn: { paddingVertical: SPACING.xl, alignItems: "center", borderWidth: 1, borderColor: COLORS.red, borderStyle: "dashed", marginTop: SPACING.lg },
  newVisitorText: { color: COLORS.red, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },

  // New visitor form
  newForm: { marginTop: SPACING.xl },
  affRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  affChip: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, borderWidth: 1, borderColor: COLORS.divider },
  affChipActive: { backgroundColor: COLORS.black, borderColor: COLORS.black },
  affText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textSecondary },
  affTextActive: { color: COLORS.white },
  createBtn: { backgroundColor: COLORS.red, height: 48, alignItems: "center", justifyContent: "center", marginTop: SPACING.xl },
  createBtnText: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },

  // Item grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  itemBtn: {
    width: "48%", backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.divider,
    padding: SPACING.lg, position: "relative",
  },
  itemBtnSelected: { backgroundColor: COLORS.black, borderColor: COLORS.black },
  itemName: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  itemStock: { fontSize: FONT_SIZE.small, color: COLORS.textSecondary, marginTop: SPACING.xs },
  checkMark: {
    position: "absolute", top: SPACING.sm, right: SPACING.sm,
    width: 24, height: 24, backgroundColor: COLORS.red,
    alignItems: "center", justifyContent: "center",
  },
  checkText: { color: COLORS.white, fontSize: 14, fontWeight: FONT_WEIGHT.bold },

  // Cart
  cartSummary: { marginTop: SPACING.xxl },
  cartRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  cartItem: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary },
  cartRemove: { fontSize: FONT_SIZE.small, color: COLORS.red, fontWeight: FONT_WEIGHT.semibold },

  // Bottom bar
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, padding: SPACING.xl, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.divider },
  confirmBtn: { backgroundColor: COLORS.red, height: 52, alignItems: "center", justifyContent: "center" },
  confirmText: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },

  // Done
  doneSection: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: SPACING.xxl },
  doneEmoji: { fontSize: 48, width: 72, height: 72, backgroundColor: COLORS.black, color: COLORS.white, textAlign: "center", lineHeight: 72, fontWeight: FONT_WEIGHT.black, marginBottom: SPACING.xl },
  doneTitle: { fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.black, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  doneName: { fontSize: FONT_SIZE.large, color: COLORS.textSecondary, marginBottom: SPACING.xl },
  doneItems: { marginBottom: SPACING.xxl },
  doneItem: { fontSize: FONT_SIZE.body, color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.semibold, textAlign: "center", paddingVertical: SPACING.xs },
  nextBtn: { backgroundColor: COLORS.red, height: 52, width: "100%", alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },
  nextBtnText: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  backToDepot: { paddingVertical: SPACING.md },
  backToDepotText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body },
});

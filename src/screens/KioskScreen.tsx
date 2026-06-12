import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Animated, Modal,
  TouchableWithoutFeedback, useWindowDimensions,
} from "react-native";
import { Audio } from "expo-av";
import { Shirt, Watch, Home, UtensilsCrossed, Briefcase, Palette, Laptop, BookOpen, Package, LucideIcon } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../constants/theme";

// ── Constants ─────────────────────────────────────────────────────────────────

const GREEN      = "#2D8C4E";
const GREEN_LIGHT = "#EBF5EE";
const GREEN_MID  = "#C5E8CF";
const GREEN_DARK = "#1A5C32";

const IDLE_TIMEOUT    = 90_000;
const IDLE_WARN_SECS  = 30;

const FACTS = [
  { emoji: "💧", stat: "2,700 liters", desc: "of water to make one t-shirt — enough to drink for 2.5 years." },
  { emoji: "♻️", stat: "80%", desc: "of items thrown away could have been reused or recycled." },
  { emoji: "👕", stat: "9 extra months", desc: "of clothing use cuts its carbon footprint by 20–30%." },
  { emoji: "🔋", stat: "82% less energy", desc: "needed to make products from recycled vs. new materials." },
  { emoji: "🗑️", stat: "292 million tons", desc: "of solid waste generated in the US each year." },
  { emoji: "🌱", stat: "1 reused item", desc: "saves all the energy, water, and emissions of making a new one." },
  { emoji: "🏠", stat: "12 million tons", desc: "of furniture thrown away annually in the US alone." },
  { emoji: "📚", stat: "32 million tons", desc: "of paper discarded every year — most of it recyclable." },
  { emoji: "🤝", stat: "You", desc: "are making Northeastern's campus greener every day." },
];

const THANK_YOU_MSGS = [
  "Every item reused is one less item in a landfill.\nThank you for making a difference! 🌱",
  "You just gave these items a second life.\nTogether we're building a greener campus! 🌍",
  "Reusing is the most powerful form of recycling.\nGreat choice for our planet! 🌿",
  "Small actions, big impact.\nYour choice to reuse helps our planet breathe easier. 🍃",
  "The greenest product is the one already made.\nYou're living that truth today! ♻️",
];

const CATEGORIES: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "clothing",    label: "Clothing",    Icon: Shirt           },
  { key: "accessories", label: "Accessories", Icon: Watch           },
  { key: "household",   label: "Household",   Icon: Home            },
  { key: "kitchen",     label: "Kitchen",     Icon: UtensilsCrossed },
  { key: "office",      label: "Office",      Icon: Briefcase       },
  { key: "craft",       label: "Craft & Art", Icon: Palette         },
  { key: "electronics", label: "Electronics", Icon: Laptop          },
  { key: "books",       label: "Books",       Icon: BookOpen        },
  { key: "others",      label: "Others",      Icon: Package         },
];

type Step = "standby" | "items" | "details" | "thankyou";
type Counts = Record<string, number>;
const emptyCounts = (): Counts => Object.fromEntries(CATEGORIES.map((c) => [c.key, 0]));

interface Props { onExit: () => void; }

// ── Component ─────────────────────────────────────────────────────────────────

export default function KioskScreen({ onExit }: Props) {
  const [step, setStep]               = useState<Step>("standby");
  const [counts, setCounts]           = useState<Counts>(emptyCounts());
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [thankYouMsg, setThankYouMsg] = useState("");
  const [savedCounts, setSavedCounts] = useState<Counts>(emptyCounts());
  const [tyCountdown, setTyCountdown] = useState(6);
  const [semesterCount, setSemesterCount] = useState<number | null>(null);

  // Fact slideshow
  const [factIndex, setFactIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Idle
  const [showIdleModal, setShowIdleModal] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(IDLE_WARN_SECS);
  const idleTimerRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const idleCountRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const tyTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const { width } = useWindowDimensions();
  const isIPad = width >= 768;
  const totalItems = Object.values(counts).reduce((s, v) => s + v, 0);

  // Audio
  const playSound = async (file: number) => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(file);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) sound.unloadAsync();
      });
    } catch {}
  };
  const playChime   = () => playSound(require("../../assets/chime.mp3"));
  const playWarning = () => playSound(require("../../assets/warning.mp3"));

  // ── Semester count ──────────────────────────────────────────────────────────
  useEffect(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const semStart = month >= 8
      ? `${year}-09-01`
      : month >= 0 && month <= 4
        ? `${year}-01-01`
        : `${year}-06-01`;
    supabase
      .from("kiosk_logs")
      .select("total_items")
      .gte("date", semStart)
      .then(({ data }) => {
        if (data) setSemesterCount(data.reduce((s, r) => s + (r.total_items || 0), 0));
      });
  }, []);

  // ── Fact rotation ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "standby") return;
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setFactIndex((i) => (i + 1) % FACTS.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [step]);

  // ── Thank you countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "thankyou") return;
    setTyCountdown(6);
    playChime();
    tyTimerRef.current = setInterval(() => {
      setTyCountdown((prev) => {
        if (prev <= 1) { clearInterval(tyTimerRef.current!); hardReset(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (tyTimerRef.current) clearInterval(tyTimerRef.current); };
  }, [step]);

  // ── Idle detection ──────────────────────────────────────────────────────────
  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIdleCountdown(IDLE_WARN_SECS);
      setShowIdleModal(true);
    }, IDLE_TIMEOUT);
  };

  useEffect(() => {
    if (step === "items" || step === "details") { resetIdleTimer(); }
    else {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setShowIdleModal(false);
    }
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [step]);

  useEffect(() => {
    if (!showIdleModal) { if (idleCountRef.current) clearInterval(idleCountRef.current); return; }
    setIdleCountdown(IDLE_WARN_SECS);
    idleCountRef.current = setInterval(() => {
      setIdleCountdown((prev) => {
        if (prev <= 1) { clearInterval(idleCountRef.current!); setShowIdleModal(false); hardReset(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (idleCountRef.current) clearInterval(idleCountRef.current); };
  }, [showIdleModal]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const hardReset = () => {
    setName(""); setEmail(""); setCounts(emptyCounts());
    setTyCountdown(6); setShowIdleModal(false); setStep("standby");
  };

  const adjust = (key: string, delta: number) => {
    resetIdleTimer();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCounts((prev) => {
      const next = { ...prev, [key]: Math.max(0, prev[key] + delta) };
      const newTotal = Object.values(next).reduce((s, v) => s + v, 0);
      if (newTotal > 3 && delta > 0) { playWarning(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert("Name required", "Please enter your name."); return; }
    setSubmitting(true);
    const items = CATEGORIES.filter((c) => counts[c.key] > 0)
      .map((c) => ({ category: c.label, quantity: counts[c.key] }));
    const { error } = await supabase.from("kiosk_logs").insert({
      full_name: name.trim(),
      email: email.trim().toLowerCase() || null,
      date: new Date().toISOString().split("T")[0],
      items,
      total_items: totalItems,
    });
    setSubmitting(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setSavedCounts({ ...counts });
    setThankYouMsg(THANK_YOU_MSGS[Math.floor(Math.random() * THANK_YOU_MSGS.length)]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep("thankyou");
  };

  // ── STANDBY ───────────────────────────────────────────────────────────────
  if (step === "standby") {
    const fact = FACTS[factIndex];
    return (
      <TouchableWithoutFeedback onPress={() => setStep("items")}>
        <View style={styles.standby}>
          <View style={styles.standbyTop}>
            <Text style={styles.standbyIcon}>♻️</Text>
            <Text style={styles.standbyTitle}>Reuse Depot</Text>
            {semesterCount !== null && (
              <View style={styles.semesterBadge}>
                <Text style={styles.semesterText}>
                  🌍  {semesterCount} items reused this semester
                </Text>
              </View>
            )}
          </View>

          <Animated.View style={[styles.factCard, { opacity: fadeAnim }]}>
            <Text style={[styles.factEmoji, isIPad && { fontSize: 100 }]}>{fact.emoji}</Text>
            <Text style={[styles.factStat, isIPad && { fontSize: 72 }]}>{fact.stat}</Text>
            <Text style={[styles.factDesc, isIPad && { fontSize: FONT_SIZE.title, lineHeight: 38 }]}>{fact.desc}</Text>
          </Animated.View>

          <View style={styles.tapPrompt}>
            <Text style={styles.tapText}>Tap anywhere to take items</Text>
            <View style={styles.tapDots}>
              {FACTS.map((_, i) => (
                <View key={i} style={[styles.dot, i === factIndex && styles.dotActive]} />
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.staffExit} onPress={onExit}>
            <Text style={styles.staffExitText}>Staff Exit</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  // ── THANK YOU ─────────────────────────────────────────────────────────────
  if (step === "thankyou") return (
    <View style={styles.thankYou}>
      <Text style={[styles.tyEmoji, isIPad && { fontSize: 120 }]}>🌱</Text>
      <Text style={[styles.tyTitle, isIPad && { fontSize: 72 }]}>Thank You!</Text>
      <Text style={[styles.tyMessage, isIPad && { fontSize: FONT_SIZE.title, lineHeight: 38, maxWidth: 600 }]}>{thankYouMsg}</Text>
      <View style={[styles.tyChips, isIPad && { maxWidth: 600 }]}>
        {CATEGORIES.filter((c) => savedCounts[c.key] > 0).map((c) => (
          <View key={c.key} style={[styles.tyChip, isIPad && { paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl }]}>
            <c.Icon size={isIPad ? 22 : 16} color={GREEN} strokeWidth={1.5} />
            <Text style={[styles.tyChipText, isIPad && { fontSize: FONT_SIZE.large }]}>{c.label}  ×  {savedCounts[c.key]}</Text>
          </View>
        ))}
      </View>
      <View style={styles.tyCountdown}>
        <Text style={[styles.tyCountdownText, isIPad && { fontSize: FONT_SIZE.body }]}>Returning to home in {tyCountdown}s</Text>
      </View>
    </View>
  );

  // ── ITEMS GRID ────────────────────────────────────────────────────────────
  if (step === "items") return (
    <>
      <View style={styles.container}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={hardReset}>
            <Text style={styles.formBack}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>What are you taking?</Text>
          <Text style={styles.formSubtitle}>Tap a category to add · We suggest up to 3 items total</Text>
        </View>

        {totalItems > 3 && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠️  {totalItems} items selected — please leave some for others!
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={[styles.grid, isIPad && styles.gridIPad]} onTouchStart={resetIdleTimer}>
          {CATEGORIES.map((cat) => {
            const count = counts[cat.key];
            const iconColor = count > 0 ? GREEN : COLORS.textSecondary;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.catCard, count > 0 && styles.catCardActive, isIPad && styles.catCardIPad]}
                onPress={() => adjust(cat.key, 1)}
                activeOpacity={0.75}
              >
                {count > 0 && (
                  <TouchableOpacity style={styles.minusBtn} onPress={() => adjust(cat.key, -1)}>
                    <Text style={styles.minusBtnText}>−</Text>
                  </TouchableOpacity>
                )}
                {count > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{count}</Text>
                  </View>
                )}
                <cat.Icon size={isIPad ? 52 : 36} color={iconColor} strokeWidth={1.5} />
                <Text style={[styles.catLabel, count > 0 && styles.catLabelActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.nextBtn, totalItems === 0 && styles.nextBtnOff]}
            onPress={() => { resetIdleTimer(); setStep("details"); }}
            disabled={totalItems === 0}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>
              Next  ·  {totalItems} item{totalItems !== 1 ? "s" : ""}  →
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <IdleModal
        visible={showIdleModal}
        countdown={idleCountdown}
        onStillHere={() => { setShowIdleModal(false); resetIdleTimer(); }}
        onGoBack={hardReset}
      />
    </>
  );

  // ── DETAILS ───────────────────────────────────────────────────────────────
  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.white }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}>

        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => { resetIdleTimer(); setStep("items"); }}>
            <Text style={styles.formBack}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>Almost done!</Text>
          <Text style={styles.formSubtitle}>Just your name so we can keep track</Text>
        </View>

        <View style={[styles.detailsBody, isIPad && styles.detailsBodyIPad]}>
          <TextInput
            style={styles.bigInput}
            placeholder="Your full name"
            placeholderTextColor={COLORS.textLight}
            value={name}
            onChangeText={(t) => { setName(t); resetIdleTimer(); }}
            autoCapitalize="words"
            autoFocus
          />
          <TextInput
            style={styles.smallInput}
            placeholder="Email (optional)"
            placeholderTextColor={COLORS.textLight}
            value={email}
            onChangeText={(t) => { setEmail(t); resetIdleTimer(); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.detailsSummary}>
            {CATEGORIES.filter((c) => counts[c.key] > 0).map((c) => (
              <Text key={c.key} style={styles.summaryItem}>
                {c.label}  ×  {counts[c.key]}
              </Text>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !name.trim()) && styles.submitBtnOff]}
            onPress={handleSubmit}
            disabled={submitting || !name.trim()}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>
              {submitting ? "Saving…" : "Submit  ✓"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <IdleModal
        visible={showIdleModal}
        countdown={idleCountdown}
        onStillHere={() => { setShowIdleModal(false); resetIdleTimer(); }}
        onGoBack={hardReset}
      />
    </>
  );
}

// ── Idle Modal (extracted for reuse) ─────────────────────────────────────────

function IdleModal({ visible, countdown, onStillHere, onGoBack }: {
  visible: boolean; countdown: number;
  onStillHere: () => void; onGoBack: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalEmoji}>👀</Text>
          <Text style={styles.modalTitle}>Still there?</Text>
          <Text style={styles.modalSub}>We'll return to home in {countdown}s</Text>
          <TouchableOpacity style={styles.modalBtn} onPress={onStillHere}>
            <Text style={styles.modalBtnText}>Yes, I'm still here</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onGoBack}>
            <Text style={styles.modalCancel}>Go back to home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },

  // Standby
  standby: {
    flex: 1, backgroundColor: GREEN_DARK,
    alignItems: "center", justifyContent: "space-between",
    paddingVertical: SPACING.xxxl, paddingHorizontal: SPACING.xxxl,
  },
  standbyTop: { alignItems: "center", gap: SPACING.sm, marginTop: SPACING.xxl },
  standbyIcon: { fontSize: 48 },
  standbyTitle: { fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.black, color: COLORS.white },
  semesterBadge: {
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl, marginTop: SPACING.sm,
  },
  semesterText: { fontSize: FONT_SIZE.small, color: GREEN_MID, fontWeight: FONT_WEIGHT.semibold },
  factCard: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.xxxl, maxWidth: 600 },
  factEmoji: { fontSize: 80, marginBottom: SPACING.xl },
  factStat: { fontSize: 52, fontWeight: FONT_WEIGHT.black, color: GREEN_MID, textAlign: "center", marginBottom: SPACING.lg },
  factDesc: { fontSize: FONT_SIZE.large, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 30 },
  tapPrompt: { alignItems: "center", gap: SPACING.lg },
  tapText: { fontSize: FONT_SIZE.body, color: "rgba(255,255,255,0.5)", letterSpacing: 1 },
  tapDots: { flexDirection: "row", gap: SPACING.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)" },
  dotActive: { backgroundColor: GREEN_MID, width: 18 },
  staffExit: { position: "absolute", bottom: SPACING.xl, right: SPACING.xl },
  staffExitText: { fontSize: FONT_SIZE.small, color: "rgba(255,255,255,0.2)", fontWeight: FONT_WEIGHT.semibold },

  // Shared header
  formHeader: {
    paddingHorizontal: SPACING.xl, paddingTop: 60, paddingBottom: SPACING.xl, backgroundColor: GREEN,
  },
  formBack: { color: "rgba(255,255,255,0.8)", fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm },
  formTitle: { color: COLORS.white, fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.black },
  formSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: FONT_SIZE.small, marginTop: SPACING.xs },

  // Warning
  warningBanner: {
    backgroundColor: "#FFF8E6", borderLeftWidth: 4, borderLeftColor: COLORS.warning,
    padding: SPACING.lg,
  },
  warningText: { fontSize: FONT_SIZE.small, color: "#7A5C00" },

  // Item grid
  grid: {
    flexDirection: "row", flexWrap: "wrap",
    padding: SPACING.lg, gap: SPACING.md, paddingBottom: 100,
  },
  gridIPad: { padding: SPACING.xl, gap: SPACING.lg },
  catCard: {
    width: "31%", height: 110, backgroundColor: COLORS.backgroundAlt,
    borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "transparent", position: "relative",
    paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.sm,
  },
  catCardIPad: { width: "23%", height: 160 },
  catCardActive: { backgroundColor: GREEN_LIGHT, borderColor: GREEN },
  catLabel: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textSecondary, textAlign: "center" },
  catLabelActive: { color: GREEN },
  countBadge: {
    position: "absolute", top: SPACING.sm, right: SPACING.sm,
    backgroundColor: GREEN, borderRadius: RADIUS.full,
    width: 26, height: 26, alignItems: "center", justifyContent: "center",
  },
  countBadgeText: { color: COLORS.white, fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.black },
  minusBtn: {
    position: "absolute", top: SPACING.sm, left: SPACING.sm,
    backgroundColor: COLORS.white, borderRadius: RADIUS.full,
    width: 26, height: 26, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.divider,
  },
  minusBtnText: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary, lineHeight: 20 },

  // Bottom bar
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: SPACING.xl, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.divider,
  },
  nextBtn: { backgroundColor: GREEN, borderRadius: RADIUS.lg, paddingVertical: SPACING.xl, alignItems: "center" },
  nextBtnOff: { backgroundColor: COLORS.divider },
  nextBtnText: { color: COLORS.white, fontSize: FONT_SIZE.large, fontWeight: FONT_WEIGHT.bold },

  // Details
  detailsBody: { flex: 1, padding: SPACING.xl, justifyContent: "center" },
  detailsBodyIPad: { maxWidth: 580, width: "100%", alignSelf: "center", paddingHorizontal: SPACING.xxxl },
  bigInput: {
    fontSize: 28, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary,
    borderBottomWidth: 3, borderBottomColor: GREEN,
    paddingVertical: SPACING.lg, marginBottom: SPACING.xl,
  },
  smallInput: {
    fontSize: FONT_SIZE.large, color: COLORS.textPrimary,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
    paddingVertical: SPACING.md, marginBottom: SPACING.xl,
  },
  detailsSummary: {
    flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm,
    marginBottom: SPACING.xxl,
  },
  summaryItem: {
    backgroundColor: GREEN_LIGHT, borderRadius: RADIUS.full,
    paddingVertical: SPACING.xs, paddingHorizontal: SPACING.lg,
    fontSize: FONT_SIZE.small, color: GREEN, fontWeight: FONT_WEIGHT.semibold,
  },
  submitBtn: {
    backgroundColor: GREEN, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.xl, alignItems: "center",
  },
  submitBtnOff: { backgroundColor: COLORS.divider },
  submitText: { color: COLORS.white, fontSize: FONT_SIZE.large, fontWeight: FONT_WEIGHT.bold },

  // Thank You
  thankYou: { flex: 1, backgroundColor: GREEN_LIGHT, alignItems: "center", justifyContent: "center", padding: SPACING.xxxl },
  tyEmoji: { fontSize: 80, marginBottom: SPACING.xl },
  tyTitle: { fontSize: 52, fontWeight: FONT_WEIGHT.black, color: GREEN, marginBottom: SPACING.xl },
  tyMessage: { fontSize: FONT_SIZE.large, color: "#3A6B4A", textAlign: "center", lineHeight: 28, marginBottom: SPACING.xxl },
  tyChips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: SPACING.sm, marginBottom: SPACING.xxl, paddingHorizontal: SPACING.xl },
  tyChip: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: GREEN_MID, borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
  },
  tyChipText: { fontSize: FONT_SIZE.body, color: GREEN_DARK, fontWeight: FONT_WEIGHT.semibold },
  tyCountdown: { backgroundColor: GREEN_MID, borderRadius: RADIUS.full, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl },
  tyCountdownText: { fontSize: FONT_SIZE.small, color: GREEN, fontWeight: FONT_WEIGHT.semibold },

  // Idle modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  modalCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xxxl, width: "60%", alignItems: "center", gap: SPACING.lg },
  modalEmoji: { fontSize: 52 },
  modalTitle: { fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.black, color: COLORS.textPrimary },
  modalSub: { fontSize: FONT_SIZE.body, color: COLORS.textSecondary, textAlign: "center", lineHeight: 24 },
  modalBtn: { backgroundColor: GREEN, borderRadius: RADIUS.md, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xxxl, width: "100%", alignItems: "center" },
  modalBtnText: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  modalCancel: { fontSize: FONT_SIZE.small, color: COLORS.textSecondary, marginTop: SPACING.sm },
});

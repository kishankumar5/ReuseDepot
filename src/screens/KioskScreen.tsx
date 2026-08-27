import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Animated, Modal,
  TouchableWithoutFeedback, useWindowDimensions,
} from "react-native";
import { Audio } from "expo-av";
import { Shirt, Watch, Home, UtensilsCrossed, Briefcase, Palette, Laptop, BookOpen, Package, LucideIcon, AlertTriangle, Trash2 } from "lucide-react-native";
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
  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
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
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const slideAnim = useRef(new Animated.Value(1)).current;

  const STAFF_PIN = "1234";
  const [idleCountdown, setIdleCountdown] = useState(IDLE_WARN_SECS);
  const idleTimerRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const idleCountRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const tyTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const { width, height } = useWindowDimensions();
  const isIPad = Math.max(width, height) >= 768;
  const isLandscape = width > height;
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
    setFirstName(""); setLastName(""); setEmail(""); setCounts(emptyCounts());
    setTyCountdown(6); setShowIdleModal(false); setStep("standby");
  };

  const navigateTo = useCallback((next: Step) => {
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(slideAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  }, [slideAnim]);

  const handlePinPress = (digit: string) => {
    setPinError(false);
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      if (next === STAFF_PIN) { setShowPinModal(false); setPin(""); onExit(); }
      else { setPinError(true); setTimeout(() => setPin(""), 600); }
    }
  };

  const adjust = (key: string, delta: number) => {
    resetIdleTimer();
    if (delta > 0 && totalItems >= 3) {
      playWarning();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) { Alert.alert("Name required", "Please enter your first and last name."); return; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { Alert.alert("Invalid email", "Please enter a valid email address or leave it blank."); return; }
    setSubmitting(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const items = CATEGORIES.filter((c) => counts[c.key] > 0)
      .map((c) => ({ category: c.label, quantity: counts[c.key] }));
    const { error } = await supabase.from("kiosk_logs").insert({
      full_name: fullName,
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
      <>
      <TouchableWithoutFeedback onPress={() => navigateTo("items")}>
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
            <View style={styles.tapPill}>
              <Text style={styles.tapText}>Tap anywhere to begin</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.staffExit} onPress={() => { setPin(""); setPinError(false); setShowPinModal(true); }}>
            <Text style={styles.staffExitText}>Staff Exit</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>

      <Modal transparent visible={showPinModal} animationType="fade">
        <View style={styles.pinOverlay}>
          <View style={styles.pinCard}>
            <Text style={styles.pinTitle}>Staff Access</Text>
            <Text style={styles.pinSub}>Enter PIN to exit kiosk mode</Text>
            <View style={styles.pinDots}>
              {[0,1,2,3].map(i => (
                <View key={i} style={[styles.pinDot, pin.length > i && styles.pinDotFilled, pinError && styles.pinDotError]} />
              ))}
            </View>
            {pinError && <Text style={styles.pinErrorText}>Incorrect PIN</Text>}
            <View style={styles.pinGrid}>
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d) => (
                <TouchableOpacity
                  key={d} style={[styles.pinKey, d === "" && { opacity: 0 }]}
                  onPress={() => d === "⌫" ? setPin(p => p.slice(0,-1)) : d !== "" && handlePinPress(d)}
                  disabled={d === ""}
                >
                  <Text style={styles.pinKeyText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setShowPinModal(false)}>
              <Text style={styles.pinCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </>
    );
  }

  // ── THANK YOU ─────────────────────────────────────────────────────────────
  if (step === "thankyou") return (
    <Animated.View style={[styles.thankYou, { opacity: slideAnim }]}>
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
    </Animated.View>
  );

  // ── ITEMS GRID ────────────────────────────────────────────────────────────
  if (step === "items") return (
    <Animated.View style={[{ flex: 1 }, { opacity: slideAnim }]}>
      <View style={styles.container}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={hardReset}>
            <Text style={styles.formBack}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.formTitle, isIPad && { fontSize: 32 }]}>What are you taking?</Text>
          <Text style={styles.formSubtitle}>Tap a category to add · We suggest up to 3 items total</Text>
        </View>

        {totalItems > 3 && (
          <View style={styles.warningBanner}>
            <AlertTriangle size={22} color={COLORS.white} strokeWidth={2} />
            <Text style={styles.warningText}>
              {totalItems} items selected — please leave some for others!
            </Text>
          </View>
        )}

        {isIPad ? (
          // iPad: perfect 3×3 flex grid that fills all available space
          <View style={styles.iPadGrid} onTouchStart={resetIdleTimer}>
            {[0, 1, 2].map((row) => (
              <View key={row} style={styles.iPadRow}>
                {CATEGORIES.slice(row * 3, row * 3 + 3).map((cat) => {
                  const count = counts[cat.key];
                  const iconColor = count > 0 ? GREEN : "#A8C5B0";
                  const maxed = totalItems >= 3 && count === 0;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.iPadCard, count > 0 && styles.catCardActive, maxed && styles.catCardDisabled]}
                      onPress={() => adjust(cat.key, 1)}
                      activeOpacity={maxed ? 0.9 : 0.75}
                    >
                      {count > 0 && (
                        <View style={[styles.countBadge, { width: 32, height: 32, top: SPACING.md, right: SPACING.md }]}>
                          <Text style={[styles.countBadgeText, { fontSize: FONT_SIZE.body }]}>{count}</Text>
                        </View>
                      )}
                      <View style={styles.cardCenter}>
                        <cat.Icon size={56} color={maxed ? "#AAAAAA" : iconColor} strokeWidth={1.5} />
                        <Text style={[styles.catLabel, count > 0 && styles.catLabelActive, maxed && { color: "#AAAAAA" }]}>{cat.label}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.removeOneBtn, count === 0 && styles.removeOneBtnHidden]}
                        onPress={(e) => { e.stopPropagation(); adjust(cat.key, -1); }}
                        disabled={count === 0}
                      >
                        <View style={styles.removeOneBtnInner}><Trash2 size={14} color={COLORS.white} strokeWidth={2} /><Text style={styles.removeOneBtnText}>Remove one</Text></View>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.grid} onTouchStart={resetIdleTimer}>
            {CATEGORIES.map((cat) => {
              const count = counts[cat.key];
              const iconColor = count > 0 ? GREEN : COLORS.textSecondary;
              const maxed = totalItems >= 3 && count === 0;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.catCard, count > 0 && styles.catCardActive, maxed && styles.catCardDisabled]}
                  onPress={() => adjust(cat.key, 1)}
                  activeOpacity={maxed ? 1 : 0.75}
                  disabled={maxed}
                >
                  {count > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{count}</Text>
                    </View>
                  )}
                  <View style={styles.cardCenter}>
                    <cat.Icon size={36} color={maxed ? COLORS.divider : iconColor} strokeWidth={1.5} />
                    <Text style={[styles.catLabel, count > 0 && styles.catLabelActive, maxed && { color: COLORS.divider }]}>{cat.label}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.removeOneBtn, count === 0 && styles.removeOneBtnHidden]}
                    onPress={(e) => { e.stopPropagation(); adjust(cat.key, -1); }}
                    disabled={count === 0}
                  >
                    <View style={styles.removeOneBtnInner}><Trash2 size={14} color={COLORS.white} strokeWidth={2} /><Text style={styles.removeOneBtnText}>Remove one</Text></View>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={[styles.bottomBar, isIPad && styles.bottomBarIPad]}>
          <TouchableOpacity
            style={[styles.nextBtn, (totalItems === 0 || totalItems > 3) && styles.nextBtnOff, isIPad && { paddingVertical: SPACING.xxl }]}
            onPress={() => { resetIdleTimer(); navigateTo("details"); }}
            disabled={totalItems === 0 || totalItems > 3}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextBtnText, isIPad && { fontSize: FONT_SIZE.title }]}>
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
    </Animated.View>
  );

  // ── DETAILS ───────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[{ flex: 1 }, { opacity: slideAnim }]}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.white }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}>

        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => { resetIdleTimer(); setStep("items"); }}>
            <Text style={styles.formBack}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>Almost done!</Text>
          <Text style={styles.formSubtitle}>First and last name are required · Email is optional</Text>
        </View>

        <View style={[styles.detailsBody, isIPad && styles.detailsBodyIPad]}>
          <View style={styles.formCard}>
            <Text style={styles.formCardLabel}>FIRST NAME <Text style={styles.formCardRequired}>*</Text></Text>
            <TextInput
              style={styles.formCardInput}
              placeholder="Enter first name"
              placeholderTextColor={COLORS.textLight}
              value={firstName}
              onChangeText={(t) => { setFirstName(t); resetIdleTimer(); }}
              autoCapitalize="words"
              autoFocus
            />
            <View style={styles.formCardDivider} />
            <Text style={styles.formCardLabel}>LAST NAME <Text style={styles.formCardRequired}>*</Text></Text>
            <TextInput
              style={styles.formCardInput}
              placeholder="Enter last name"
              placeholderTextColor={COLORS.textLight}
              value={lastName}
              onChangeText={(t) => { setLastName(t); resetIdleTimer(); }}
              autoCapitalize="words"
            />
            <View style={styles.formCardDivider} />
            <Text style={styles.formCardLabel}>EMAIL <Text style={styles.formCardOptional}>(optional)</Text></Text>
            <TextInput
              style={[styles.formCardInput, email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.includes("@") && styles.formCardInputError]}
              placeholder="Enter email address"
              placeholderTextColor={COLORS.textLight}
              value={email}
              onChangeText={(t) => { setEmail(t); resetIdleTimer(); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {email.includes("@") === false && email.length > 0 && (
              <View style={styles.emailDropdown}>
                {["@northeastern.edu", "@gmail.com", "@yahoo.com"].map((suffix, i) => (
                  <TouchableOpacity
                    key={suffix}
                    style={[styles.emailDropdownItem, i < 2 && styles.emailDropdownDivider]}
                    onPress={() => { setEmail(email + suffix); resetIdleTimer(); }}
                  >
                    <Text style={styles.emailDropdownText}>{email}<Text style={styles.emailDropdownSuffix}>{suffix}</Text></Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.includes("@") && (
              <Text style={styles.emailErrorText}>Please enter a valid email address</Text>
            )}
            <View style={styles.newsletterInline}>
              <Text style={styles.newsletterInlineText}>📬  Add your email to get first access to new arrivals and depot events!</Text>
            </View>

            <View style={styles.formCardDivider} />

            <View style={styles.detailsSummary}>
              {CATEGORIES.filter((c) => counts[c.key] > 0).map((c) => (
                <Text key={c.key} style={styles.summaryItem}>
                  {c.label}  ×  {counts[c.key]}
                </Text>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, (submitting || !firstName.trim() || !lastName.trim()) && styles.submitBtnOff]}
              onPress={handleSubmit}
              disabled={submitting || !firstName.trim() || !lastName.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.submitText}>
                {submitting ? "Saving…" : "Submit  ✓"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <IdleModal
        visible={showIdleModal}
        countdown={idleCountdown}
        onStillHere={() => { setFirstName(""); setLastName(""); setEmail(""); setShowIdleModal(false); resetIdleTimer(); }}
        onGoBack={hardReset}
      />
    </Animated.View>
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
  tapPrompt: { alignItems: "center" },
  tapPill: {
    backgroundColor: "rgba(255,255,255,0.18)", borderRadius: RADIUS.full,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxxl,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
  },
  tapText: { fontSize: FONT_SIZE.large, color: COLORS.white, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0.5 },
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
    backgroundColor: "#FF6B35", flexDirection: "row",
    alignItems: "center", padding: SPACING.lg, gap: SPACING.sm,
  },
  warningText: { fontSize: FONT_SIZE.body, color: COLORS.white, fontWeight: FONT_WEIGHT.semibold },

  // iPad 3x3 grid
  iPadGrid: { flex: 1, padding: SPACING.lg, gap: SPACING.md },
  iPadRow: { flex: 1, flexDirection: "row", gap: SPACING.md },
  iPadCard: {
    flex: 1, backgroundColor: COLORS.backgroundAlt,
    borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "space-between",
    borderWidth: 2, borderColor: "transparent", overflow: "hidden",
    flexDirection: "column",
  },

  // Item grid
  grid: {
    flexDirection: "row", flexWrap: "wrap",
    padding: SPACING.lg, gap: SPACING.md, paddingBottom: 100,
  },
  gridIPad: { padding: SPACING.xl, gap: SPACING.lg, flexGrow: 1, alignContent: "stretch" },
  catCard: {
    width: "31%", backgroundColor: COLORS.backgroundAlt,
    borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "space-between",
    borderWidth: 2, borderColor: "transparent", overflow: "hidden",
    flexDirection: "column",
  },
  catCardIPad: { width: "23%", flexGrow: 1, minHeight: 160 },
  catCardActive: { backgroundColor: GREEN_LIGHT, borderColor: GREEN },
  catCardDisabled: { opacity: 0.6 },
  catLabel: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textSecondary, textAlign: "center" },
  catLabelActive: { color: GREEN },
  countBadge: {
    position: "absolute", top: SPACING.sm, right: SPACING.sm,
    backgroundColor: GREEN, borderRadius: RADIUS.full,
    width: 26, height: 26, alignItems: "center", justifyContent: "center",
  },
  countBadgeText: { color: COLORS.white, fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.black },
  cardCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.md },
  removeOneBtn: {
    alignSelf: "stretch", alignItems: "center",
    paddingVertical: SPACING.md,
    backgroundColor: "#FF6B35",
  },
  removeOneBtnHidden: { opacity: 0 },
  removeOneBtnText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: COLORS.white, letterSpacing: 0.5 },

  // Bottom bar
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: SPACING.xl, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.divider,
  },
  bottomBarIPad: {
    position: "relative", bottom: undefined, left: undefined, right: undefined,
  },
  nextBtn: { backgroundColor: GREEN, borderRadius: RADIUS.lg, paddingVertical: SPACING.xl, alignItems: "center" },
  nextBtnOff: { backgroundColor: COLORS.divider },
  nextBtnText: { color: COLORS.white, fontSize: FONT_SIZE.large, fontWeight: FONT_WEIGHT.bold },

  // Details
  detailsBody: { flex: 1, padding: SPACING.xl, justifyContent: "center" },
  detailsBodyIPad: { maxWidth: 580, width: "100%", alignSelf: "center", paddingHorizontal: SPACING.xxxl },
  formCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.divider,
    padding: SPACING.xl, marginBottom: SPACING.lg,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  formCardLabel: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: COLORS.textSecondary, letterSpacing: 1.2, marginBottom: SPACING.sm },
  formCardRequired: { color: COLORS.red },
  formCardOptional: { color: COLORS.textLight, fontWeight: FONT_WEIGHT.regular, letterSpacing: 0 },
  formCardInput: {
    fontSize: FONT_SIZE.large, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary,
    paddingVertical: SPACING.md, marginBottom: SPACING.md,
  },
  formCardInputError: { color: COLORS.red },
  formCardDivider: { height: 1, backgroundColor: COLORS.divider, marginBottom: SPACING.lg },
  removeOneBtnInner: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  inputError: { borderBottomColor: COLORS.red },
  emailDropdown: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.divider,
    borderRadius: RADIUS.md, marginBottom: SPACING.md,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  emailDropdownItem: { paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg },
  emailDropdownDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  emailDropdownText: { fontSize: FONT_SIZE.body, color: COLORS.textPrimary },
  emailDropdownSuffix: { color: GREEN, fontWeight: FONT_WEIGHT.semibold },
  emailErrorText: { fontSize: FONT_SIZE.small, color: COLORS.red, marginTop: -SPACING.lg, marginBottom: SPACING.lg },
  newsletterInline: {
    backgroundColor: GREEN_LIGHT, borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.sm, marginBottom: SPACING.md,
  },
  newsletterInlineText: { fontSize: FONT_SIZE.small, color: GREEN_DARK, lineHeight: 18 },
  newsletterCard: {
    backgroundColor: GREEN_LIGHT, borderWidth: 1, borderColor: GREEN_MID,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.xxl,
  },
  newsletterTitle: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: GREEN_DARK, marginBottom: SPACING.xs },
  newsletterBody: { fontSize: FONT_SIZE.small, color: GREEN_DARK, lineHeight: 20 },
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
    backgroundColor: GREEN, borderRadius: RADIUS.md,
    paddingVertical: SPACING.xl, alignItems: "center",
    marginTop: SPACING.lg,
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

  // PIN modal
  pinOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  pinCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.xxxl, alignItems: "center", width: 340 },
  pinTitle: { fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.black, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  pinSub: { fontSize: FONT_SIZE.small, color: COLORS.textSecondary, marginBottom: SPACING.xl },
  pinDots: { flexDirection: "row", gap: SPACING.lg, marginBottom: SPACING.sm },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.divider, backgroundColor: "transparent" },
  pinDotFilled: { backgroundColor: GREEN, borderColor: GREEN },
  pinDotError: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  pinErrorText: { fontSize: FONT_SIZE.small, color: COLORS.red, marginBottom: SPACING.md },
  pinGrid: { flexDirection: "row", flexWrap: "wrap", width: 240, gap: SPACING.md, marginTop: SPACING.xl, marginBottom: SPACING.lg },
  pinKey: { width: 68, height: 68, borderRadius: RADIUS.full, backgroundColor: COLORS.backgroundAlt, alignItems: "center", justifyContent: "center" },
  pinKeyText: { fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  pinCancel: { fontSize: FONT_SIZE.small, color: COLORS.textSecondary, marginTop: SPACING.sm },
});

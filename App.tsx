import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { supabase } from "./src/lib/supabase";
import { Location, Coordinator } from "./src/types";
import { COLORS } from "./src/constants/theme";

import LoginScreen from "./src/screens/LoginScreen";
import ModeSelectScreen from "./src/screens/ModeSelectScreen";
import LocationSelectScreen from "./src/screens/LocationSelectScreen";
import QuickLogScreen from "./src/screens/QuickLogScreen";
import CounterScreen from "./src/screens/CounterScreen";
import InventoryScreen from "./src/screens/InventoryScreen";
import DepotHomeScreen from "./src/screens/DepotHomeScreen";
import DepotReceiveScreen from "./src/screens/DepotReceiveScreen";
import CheckoutScreen from "./src/screens/CheckoutScreen";

type Screen =
  | "loading" | "login" | "mode-select"
  | "location-select" | "quick-log" | "counter" | "inventory"
  | "depot-home" | "depot-receive" | "depot-checkout";

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [depotLocationId, setDepotLocationId] = useState<string | null>(null);

  useEffect(() => {
    init();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { setCoordinator(null); setLocation(null); setScreen("login"); }
    });
    return () => { listener.subscription.unsubscribe(); };
  }, []);

  const init = async () => {
    const { data: locs } = await supabase.from("locations").select("*").order("name");
    if (locs) {
      setAllLocations(locs);
      // Use first location as depot location fallback
      // You can change this to a specific "Reuse Depot" location later
      const depot = locs.find((l) => l.name.toLowerCase().includes("depot")) || locs[0];
      if (depot) setDepotLocationId(depot.id);
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await loadCoordinator(session.user.id);
    else setScreen("login");
  };

  const loadCoordinator = async (userId: string) => {
    const { data } = await supabase.from("coordinators").select("*").eq("user_id", userId).single();
    if (data) { setCoordinator(data); setScreen("mode-select"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: c } = await supabase.from("coordinators")
        .insert({ user_id: user.id, name: user.email?.split("@")[0] || "Coordinator", email: user.email || "" })
        .select().single();
      if (c) { setCoordinator(c); setScreen("mode-select"); return; }
    }
    setScreen("login");
  };

  const handleLogin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await loadCoordinator(user.id);
  };

  if (screen === "loading") return (
    <View style={styles.loading}><ActivityIndicator color={COLORS.red} /><StatusBar style="light" /></View>
  );

  return (
    <>
      <StatusBar style="light" />

      {screen === "login" && <LoginScreen onLogin={handleLogin} />}

      {screen === "mode-select" && coordinator && (
        <ModeSelectScreen
          coordinatorName={coordinator.name}
          onSelectDrive={() => setScreen("location-select")}
          onSelectDepot={() => setScreen("depot-home")}
          onLogout={() => supabase.auth.signOut()}
        />
      )}

      {/* ===== DRIVE MODE ===== */}
      {screen === "location-select" && coordinator && (
        <LocationSelectScreen
          onSelect={(l) => { setLocation(l); setScreen("quick-log"); }}
          onLogout={() => supabase.auth.signOut()}
          coordinatorName={coordinator.name}
        />
      )}

      {screen === "quick-log" && location && coordinator && (
        <QuickLogScreen
          location={location}
          coordinatorId={coordinator.id}
          onChangeLocation={() => { setLocation(null); setScreen("location-select"); }}
          onViewCounter={() => setScreen("counter")}
          onViewInventory={() => setScreen("inventory")}
        />
      )}

      {screen === "counter" && location && (
        <CounterScreen location={location} onBack={() => setScreen("quick-log")} />
      )}

      {screen === "inventory" && location && (
        <InventoryScreen locations={allLocations} currentLocation={location} onBack={() => setScreen("quick-log")} />
      )}

      {/* ===== DEPOT MODE ===== */}
      {screen === "depot-home" && (
        <DepotHomeScreen
          onReceive={() => setScreen("depot-receive")}
          onCheckout={() => setScreen("depot-checkout")}
          onBack={() => setScreen("mode-select")}
        />
      )}

      {screen === "depot-receive" && coordinator && depotLocationId && (
        <DepotReceiveScreen
          coordinatorId={coordinator.id}
          locationId={depotLocationId}
          onBack={() => setScreen("depot-home")}
        />
      )}

      {screen === "depot-checkout" && coordinator && (
        <CheckoutScreen
          coordinatorId={coordinator.id}
          onBack={() => setScreen("depot-home")}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.black },
});
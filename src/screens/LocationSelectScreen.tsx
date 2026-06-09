import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,Image} from "react-native";
import { supabase } from "../lib/supabase";
import { Location } from "../types";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from "../constants/theme";

interface Props {
  onSelect: (location: Location) => void;
  onLogout: () => void;
  coordinatorName: string;
}

export default function LocationSelectScreen({ onSelect, onLogout, coordinatorName }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("locations").select("*").order("name").then(({ data }) => {
      if (data) setLocations(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator color={COLORS.red} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Image 
                      source={require("../../assets/NULogo.png")} 
                      style={{ width: 48, height: 48 }} 
                      resizeMode="contain" 
                    />
          <TouchableOpacity onPress={onLogout}><Text style={styles.logoutText}>Log out</Text></TouchableOpacity>
        </View>
        <Text style={styles.greeting}>Hi, {coordinatorName}</Text>
        <Text style={styles.title}>Select your station</Text>
      </View>

      <FlatList
        data={locations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => onSelect(item)} activeOpacity={0.7}>
            <View style={styles.cardLeft} />
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>
                {item.pod_count} POD{item.pod_count > 1 ? "s" : ""}
                {item.has_landfill_dumpster ? " · Landfill" : ""}
                {item.has_recycling_dumpster ? " · Recycling" : ""}
              </Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  center: { justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: SPACING.xl, paddingTop: 64, paddingBottom: SPACING.xl, backgroundColor: COLORS.black },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.xl },
  brandMark: { width: 32, height: 32, backgroundColor: COLORS.red, alignItems: "center", justifyContent: "center" },
  brandN: { color: COLORS.white, fontSize: 18, fontWeight: FONT_WEIGHT.black, fontStyle: "italic" },
  logoutText: { color: COLORS.textLight, fontSize: FONT_SIZE.small },
  greeting: { color: COLORS.textLight, fontSize: FONT_SIZE.body, marginBottom: SPACING.xs },
  title: { color: COLORS.white, fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.black },
  list: { padding: SPACING.xl },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.divider, marginBottom: SPACING.md, overflow: "hidden",
  },
  cardLeft: { width: 4, alignSelf: "stretch", backgroundColor: COLORS.red },
  cardContent: { flex: 1, paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg },
  cardTitle: { fontSize: FONT_SIZE.large, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  cardMeta: { fontSize: FONT_SIZE.small, color: COLORS.textSecondary, marginTop: SPACING.xs },
  arrow: { fontSize: FONT_SIZE.title, color: COLORS.red, paddingRight: SPACING.lg },
});
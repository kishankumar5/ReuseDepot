import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  Keyboard, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,Image
} from "react-native";
import { supabase } from "../lib/supabase";
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from "../constants/theme";

interface Props { onLogin: () => void; }

export default function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) { Alert.alert("Missing fields", "Enter email and password."); return; }
    setLoading(true);

    if (isSignUp) {
      if (!name.trim()) { Alert.alert("Missing name", "Enter your name."); setLoading(false); return; }
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) { Alert.alert("Error", authError.message); setLoading(false); return; }
      if (authData.user) {
        await supabase.from("coordinators").insert({
          user_id: authData.user.id, name: name.trim(), email: email.toLowerCase().trim(),
        });
      }
      onLogin();
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { Alert.alert("Error", error.message); setLoading(false); return; }
      onLogin();
    }
    setLoading(false);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.inner}>
          <Image 
            source={require("../../assets/NULogo.png")} 
            style={{ width: 48, height: 48 }} 
            resizeMode="contain" 
          />

          <Text style={styles.appName}>ReuseScan</Text>
          <Text style={styles.tagline}>Move Out Reusables Drive</Text>
          <Text style={styles.year}>Spring 2026</Text>

          <View style={styles.form}>
            {isSignUp && (
              <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={COLORS.textLight}
                value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" />
            )}
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={COLORS.textLight}
              value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor={COLORS.textLight}
              value={password} onChangeText={setPassword} secureTextEntry returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />

            <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleAuth} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.white} /> :
                <Text style={styles.buttonText}>{isSignUp ? "Create account" : "Log in"}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.switchBtn}>
              <Text style={styles.switchText}>
                {isSignUp ? "Already have an account? Log in" : "New coordinator? Create account"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: SPACING.xxl },
  brandBar: {
    width: 48, height: 48, backgroundColor: COLORS.red,
    alignItems: "center", justifyContent: "center", marginBottom: SPACING.xl,
  },
  brandN: { color: COLORS.white, fontSize: 28, fontWeight: FONT_WEIGHT.black, fontStyle: "italic" },
  appName: { fontSize: FONT_SIZE.hero, fontWeight: FONT_WEIGHT.black, color: COLORS.black, letterSpacing: -0.5 },
  tagline: { fontSize: FONT_SIZE.large, color: COLORS.textSecondary, marginTop: SPACING.xs },
  year: { fontSize: FONT_SIZE.body, color: COLORS.textLight, marginTop: SPACING.xs, marginBottom: SPACING.xxxl },
  form: {},
  input: {
    height: 52, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
    fontSize: FONT_SIZE.body, color: COLORS.textPrimary, marginBottom: SPACING.sm,
  },
  button: {
    height: 52, backgroundColor: COLORS.red, alignItems: "center",
    justifyContent: "center", marginTop: SPACING.xl,
  },
  buttonText: { color: COLORS.white, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5 },
  switchBtn: { marginTop: SPACING.xl, alignItems: "center" },
  switchText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.small },
});
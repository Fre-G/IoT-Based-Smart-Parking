// components/UI.js – Crash‑free version
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput as RNInput } from 'react-native';
import { C, R, Sh } from '../theme';

export function PrimaryButton({ label, onPress, icon, disabled, style, small }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.82} style={[{ borderRadius: R.md }, Sh.teal, style]}>
      <View style={[styles.btn, small && styles.btnSm, { backgroundColor: disabled ? '#1A2A40' : C.teal }]}>
        {icon ? <Text style={styles.btnIcon}>{icon}</Text> : null}
        <Text style={[styles.btnLabel, disabled && { color: C.t3 }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function GhostButton({ label, onPress, icon, color, style }) {
  const c = color || C.teal;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.ghost, { borderColor: c + '60' }, style]}>
      {icon ? <Text style={[styles.ghostIcon, { color: c }]}>{icon}</Text> : null}
      <Text style={[styles.ghostLabel, { color: c }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function DangerButton({ label, onPress, icon, style }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.danger, style]}>
      {icon ? <Text style={styles.dangerIcon}>{icon}</Text> : null}
      <Text style={styles.dangerLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export function InputField({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, error, toggleSecure }) {
  return (
    <View style={[styles.inputWrap, error && { borderColor: C.red }]}>
      {icon ? <Text style={styles.inputIcon}>{icon}</Text> : null}
      <RNInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={C.t3}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'none'}
      />
      {toggleSecure && (
        <TouchableOpacity onPress={toggleSecure} style={{ padding: 8 }}>
          <Text style={{ color: C.t2, fontSize: 18 }}>{secureTextEntry ? '👁️' : '🙈'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function Card({ children, style, glow }) {
  return <View style={[styles.card, glow && Sh.card, style]}>{children}</View>;
}

export function GlowCard({ children, style }) {
  return <View style={[styles.card, Sh.card, style, { backgroundColor: C.bg2 }]}>{children}</View>;
}

export function Pill({ label, type, size }) {
  const map = {
    success: { bg: C.greenBg, text: C.green, dot: C.green },
    warning: { bg: C.goldBg, text: C.gold, dot: C.gold },
    danger: { bg: C.redBg, text: C.red, dot: C.red },
    info: { bg: C.blueBg, text: C.blue, dot: C.blue },
    teal: { bg: C.tealBg, text: C.teal, dot: C.teal },
    orange: { bg: C.orangeBg, text: C.orange, dot: C.orange },
  };
  const t = map[type] || map.teal;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, size === 'sm' && styles.pillSm]}>
      <View style={[styles.pillDot, { backgroundColor: t.dot }]} />
      <Text style={[styles.pillText, { color: t.text }, size === 'sm' && { fontSize: 10 }]}>{label}</Text>
    </View>
  );
}

export function RowInfo({ icon, label, value, valueColor }) {
  return (
    <View style={styles.rowInfo}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

export function SectionLabel({ text, right, onRight }) {
  return (
    <View style={styles.secRow}>
      <Text style={styles.secText}>{text}</Text>
      {right && <TouchableOpacity onPress={onRight}><Text style={styles.secRight}>{right}</Text></TouchableOpacity>}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Loader() {
  return (
    <View style={styles.loaderWrap}>
      <ActivityIndicator size="large" color={C.teal} />
      <Text style={{ color: C.t2, marginTop: 14, fontSize: 14, fontWeight: '600' }}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: R.md, paddingVertical: 16, paddingHorizontal: 24 },
  btnSm: { paddingVertical: 10, paddingHorizontal: 16 },
  btnIcon: { fontSize: 18, marginRight: 8 },
  btnLabel: { color: C.inv, fontSize: 16, fontWeight: '800' },
  ghost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: R.md, paddingVertical: 14, paddingHorizontal: 20, borderWidth: 1.5 },
  ghostIcon: { fontSize: 16, marginRight: 8 },
  ghostLabel: { fontSize: 15, fontWeight: '700' },
  danger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: R.md, paddingVertical: 14, paddingHorizontal: 20, backgroundColor: C.redBg, borderWidth: 1.5, borderColor: C.red + '50' },
  dangerIcon: { fontSize: 16, marginRight: 8 },
  dangerLabel: { color: C.red, fontSize: 15, fontWeight: '800' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg2, borderRadius: R.md, borderWidth: 1.5, borderColor: C.border, marginBottom: 14, paddingHorizontal: 16 },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, color: C.t1, fontSize: 15, paddingVertical: 15 },
  card: { backgroundColor: C.bg2, borderRadius: R.lg, padding: 16, borderWidth: 1, borderColor: C.border },
  pill: { flexDirection: 'row', alignItems: 'center', borderRadius: R.full, paddingVertical: 5, paddingHorizontal: 12 },
  pillSm: { paddingVertical: 3, paddingHorizontal: 9 },
  pillDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  pillText: { fontSize: 12, fontWeight: '700' },
  rowInfo: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  rowIcon: { fontSize: 16, width: 26, marginRight: 8 },
  rowLabel: { flex: 1, fontSize: 14, color: C.t2, fontWeight: '500' },
  rowValue: { fontSize: 14, fontWeight: '700', color: C.t1 },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  secText: { fontSize: 12, fontWeight: '800', color: C.t3, textTransform: 'uppercase', letterSpacing: 1.4 },
  secRight: { fontSize: 13, color: C.teal, fontWeight: '700' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  loaderWrap: { flex: 1, backgroundColor: C.bg1, alignItems: 'center', justifyContent: 'center' },
});

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, StatusBar, ScrollView, TextInput, Linking
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, R, Sh } from '../theme';
import { PrimaryButton, SectionLabel } from '../components/UI';

export default function HelpSupportScreen({ navigation }) {
  const { t } = useTranslation();
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [sending, setSending] = useState(false);

  const faqs = [
    { q: 'helpSupport.faq1.q', a: 'helpSupport.faq1.a' },
    { q: 'helpSupport.faq2.q', a: 'helpSupport.faq2.a' },
    { q: 'helpSupport.faq3.q', a: 'helpSupport.faq3.a' },
    { q: 'helpSupport.faq4.q', a: 'helpSupport.faq4.a' },
    { q: 'helpSupport.faq5.q', a: 'helpSupport.faq5.a' },
  ];

  const sendReport = async () => {
    if (!reportText.trim()) {
      Alert.alert(t('common.error'), t('helpSupport.reportEmpty'));
      return;
    }
    setSending(true);
    try {
      const timestamp = new Date().toISOString();
      const report = { text: reportText, timestamp, user: 'current_user' };
      const existing = await AsyncStorage.getItem('user_reports');
      const reports = existing ? JSON.parse(existing) : [];
      reports.push(report);
      await AsyncStorage.setItem('user_reports', JSON.stringify(reports));
      Alert.alert(t('common.success'), t('helpSupport.reportSent'));
      setReportText('');
      setShowReport(false);
    } catch (error) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setSending(false);
    }
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:frezergez21@gmail.com?subject=Help%20Request');
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:+251903231921');
  };

  const handleWhatsApp = () => {
    Linking.openURL('https://wa.me/251903231921?text=Hello%2C%20I%20need%20help%20with%20SmartPark');
  };

  const currentVersion = '1.0.0';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg0} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('helpSupport.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SectionLabel text={t('helpSupport.faq')} />
        {faqs.map((faq, idx) => (
          <View key={idx} style={styles.faqItem}>
            <Text style={styles.faqQuestion}>❓ {t(faq.q)}</Text>
            <Text style={styles.faqAnswer}>{t(faq.a)}</Text>
          </View>
        ))}

        <SectionLabel text={t('helpSupport.contactUs')} style={styles.sectionMargin} />
        
        <TouchableOpacity style={styles.contactItem} onPress={handleEmailSupport}>
          <Text style={styles.contactIcon}>✉️</Text>
          <Text style={styles.contactText}>{t('helpSupport.emailSupport')}</Text>
          <Text style={styles.contactArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactItem} onPress={handleCallSupport}>
          <Text style={styles.contactIcon}>📞</Text>
          <Text style={styles.contactText}>{t('helpSupport.callSupport')}</Text>
          <Text style={styles.contactArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactItem} onPress={handleWhatsApp}>
          <Text style={styles.contactIcon}>💬</Text>
          <Text style={styles.contactText}>{t('helpSupport.whatsapp')}</Text>
          <Text style={styles.contactArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.reportButton} onPress={() => setShowReport(!showReport)}>
          <Text style={styles.reportButtonText}>{t('helpSupport.reportIssue')}</Text>
        </TouchableOpacity>

        {showReport && (
          <View style={styles.reportForm}>
            <TextInput
              style={styles.reportInput}
              placeholder={t('helpSupport.reportDescription')}
              placeholderTextColor={C.t3}
              multiline
              numberOfLines={4}
              value={reportText}
              onChangeText={setReportText}
            />
            <PrimaryButton
              label={sending ? t('common.sending') : t('helpSupport.sendReport')}
              onPress={sendReport}
              disabled={sending}
            />
          </View>
        )}

        <Text style={styles.version}>
          {t('helpSupport.version')}: {currentVersion}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    backgroundColor: C.bg2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  backArrow: { color: C.t1, fontSize: 20 },
  title: { fontSize: 24, fontWeight: '900', color: C.t1, letterSpacing: -0.5 },
  scroll: { padding: 20, paddingBottom: 40 },
  faqItem: {
    backgroundColor: C.bg2,
    borderRadius: R.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    ...Sh.soft,
  },
  faqQuestion: { fontSize: 15, fontWeight: '700', color: C.t1, marginBottom: 8 },
  faqAnswer: { fontSize: 13, color: C.t2, lineHeight: 18 },
  sectionMargin: { marginTop: 16, marginBottom: 8 },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg2,
    borderRadius: R.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  contactIcon: { fontSize: 24, marginRight: 14 },
  contactText: { flex: 1, fontSize: 15, color: C.t1, fontWeight: '500' },
  contactArrow: { fontSize: 18, color: C.t3 },
  reportButton: {
    backgroundColor: C.bg2,
    borderRadius: R.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.teal + '40',
  },
  reportButtonText: { color: C.teal, fontSize: 16, fontWeight: '700' },
  reportForm: {
    backgroundColor: C.bg2,
    borderRadius: R.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  reportInput: {
    backgroundColor: C.bg1,
    borderRadius: R.md,
    padding: 12,
    fontSize: 14,
    color: C.t1,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  version: { textAlign: 'center', color: C.t3, fontSize: 12, marginTop: 24 },
});
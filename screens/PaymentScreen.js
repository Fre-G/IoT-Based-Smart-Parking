import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Modal, ActivityIndicator, StatusBar
} from 'react-native';
import { WebView } from 'react-native-webview';
import { auth, db } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { C, R, Sh } from '../theme';
import { Loader } from '../components/UI';

export default function PaymentScreen({ route, navigation }) {
  const { sessionId, amount } = route.params;
  const [showWV, setShowWV] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [webLoading, setWebLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const wvRef = useRef(null);

  const initiatePayment = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) { Alert.alert('Error', 'Sign in required.'); return; }
      const snap = await getDoc(doc(db, 'users', user.uid));
      const userData = snap.data();
      const parts = (userData?.fullName || 'Customer').split(' ');
      const res = await fetch('https://parking-payment-backend.onrender.com/api/initiate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.max(1, Number(amount)),
          email: user.email,
          first_name: parts[0],
          last_name: parts.slice(1).join(' ') || 'Customer',
          phone_number: userData?.phone || '0999999999',
        }),
      });
      const data = await res.json();
      if (data.checkout_url) { setUrl(data.checkout_url); setShowWV(true); setPaid(false); }
      else Alert.alert('Payment Error', data.error?.message || data.error || 'Failed to initialize payment.');
    } catch (e) { Alert.alert('Network Error', e.message); }
    finally { setLoading(false); }
  };

  const finalizePayment = async () => {
    try {
      await updateDoc(doc(db, 'parkingSessions', sessionId), { paymentStatus: 'paid' });
      const snap = await getDoc(doc(db, 'parkingSessions', sessionId));
      const stRef = doc(db, 'parkingStations', snap.data().stationId);
      const stSn = await getDoc(stRef);
      await updateDoc(stRef, { available_slots: (stSn.data().available_slots ?? 0) + 1 });
      Alert.alert('Payment Successful ✅', `${amount} ETB paid. Thank you!`);
      setShowWV(false);
      navigation.navigate('Main');
    } catch (e) { Alert.alert('Error', e.message); setShowWV(false); navigation.navigate('Main'); }
  };

  const onNavChange = (state) => {
    if (state.url.includes('checkout.chapa.co') && !paid) {
      setTimeout(() => {
        wvRef.current?.injectJavaScript(`
          (function(){
            if(document.getElementById('sp-done')) return;
            var b=document.createElement('button');
            b.id='sp-done';
            b.innerHTML='✔ Done — Return to App';
            Object.assign(b.style,{position:'fixed',bottom:'24px',left:'50%',transform:'translateX(-50%)',
              zIndex:'9999',background: '#00E5C4',color:'#060B18',
              border:'none',borderRadius:'14px',padding:'14px 32px',fontSize:'16px',fontWeight:'900',
              cursor:'pointer',boxShadow:'0 4px 24px rgba(0,229,196,0.4)',whiteSpace:'nowrap'});
            b.onclick=()=>window.ReactNativeWebView.postMessage('done');
            document.body.appendChild(b);
          })();
        `);
        setPaid(true);
      }, 3000);
    }
  };

  const onMsg = (e) => { if (e.nativeEvent.data === 'done') finalizePayment(); };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg0} />
      <View style={[styles.blob, { top: -100, right: -80, backgroundColor: C.tealGlow, width: 280, height: 280 }]} />
      <View style={[styles.blob, { bottom: 80, left: -80, backgroundColor: C.goldGlow, width: 220, height: 220 }]} />
      <View style={styles.inner}>
        <View style={[styles.iconCircle, Sh.teal]}>
          <Text style={{ fontSize: 38 }}>💳</Text>
        </View>
        <Text style={styles.title}>Complete Payment</Text>
        <Text style={styles.sub}>Secure checkout via Chapa</Text>
        <View style={styles.amountCard}>
          <View style={styles.amountAccent} />
          <View style={styles.amountBody}>
            <Text style={styles.amountLabel}>Total Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountCur}>ETB</Text>
              <Text style={styles.amountVal}>{Number(amount).toFixed(2)}</Text>
            </View>
            <Text style={styles.amountNote}>Includes parking fee + service charge</Text>
          </View>
        </View>
        <View style={styles.featsRow}>
          {['🔒 Secure', '⚡ Instant', '📱 Mobile'].map(f => (
            <View key={f} style={styles.featItem}><Text style={styles.featText}>{f}</Text></View>
          ))}
        </View>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.teal} />
            <Text style={styles.loadingText}>Connecting to Chapa...</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={initiatePayment} activeOpacity={0.85} style={{ width: '100%', ...Sh.teal }}>
            <View style={styles.payBtn}>
              <Text style={styles.payBtnIcon}>⚡</Text>
              <Text style={styles.payBtnText}>Pay with Chapa</Text>
            </View>
          </TouchableOpacity>
        )}
        <Text style={styles.disclaimer}>🔐 Payments processed securely by Chapa • No card data stored</Text>
      </View>

      <Modal visible={showWV} animationType="slide" onRequestClose={() => { if (!paid) Alert.alert('Payment Ongoing', 'Please complete payment first.'); }}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Chapa Checkout</Text>
              <Text style={styles.modalSub}>Complete your payment below</Text>
            </View>
            <TouchableOpacity onPress={() => { paid ? finalizePayment() : Alert.alert('Payment Ongoing', 'Finish payment first.'); }} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBar} />
          {showWV && url !== '' && (
            <WebView
              ref={wvRef}
              source={{ uri: url }}
              onNavigationStateChange={onNavChange}
              onShouldStartLoadWithRequest={r => !r.url.includes('/success')}
              onMessage={onMsg}
              onLoadStart={() => setWebLoading(true)}
              onLoadEnd={() => setWebLoading(false)}
              javaScriptEnabled domStorageEnabled
              style={{ flex: 1 }}
            />
          )}
          {webLoading && (
            <View style={styles.webLoader}>
              <ActivityIndicator size="large" color={C.teal} />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg0 },
  blob: { position: 'absolute', borderRadius: 999 },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  iconCircle: { width: 88, height: 88, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 20, backgroundColor: C.teal },
  title: { fontSize: 28, fontWeight: '900', color: C.t1, letterSpacing: -0.8, marginBottom: 6 },
  sub: { fontSize: 14, color: C.t2, marginBottom: 28, fontWeight: '500' },
  amountCard: { width: '100%', borderRadius: R.xl, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: C.border, backgroundColor: '#0C1E3A', ...Sh.card },
  amountAccent: { height: 3, backgroundColor: C.teal },
  amountBody: { padding: 20 },
  amountLabel: { fontSize: 12, fontWeight: '700', color: C.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 8 },
  amountCur: { fontSize: 20, fontWeight: '700', color: C.teal, marginBottom: 6 },
  amountVal: { fontSize: 52, fontWeight: '900', color: C.teal, letterSpacing: -2 },
  amountNote: { fontSize: 12, color: C.t3 },
  featsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  featItem: { flex: 1, backgroundColor: C.bg2, borderRadius: R.md, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  featText: { fontSize: 12, color: C.t2, fontWeight: '600' },
  loadingBox: { alignItems: 'center', gap: 14, paddingVertical: 20 },
  loadingText: { color: C.t2, fontSize: 14, fontWeight: '600' },
  payBtn: { borderRadius: R.md, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', backgroundColor: C.teal },
  payBtnIcon: { fontSize: 22 },
  payBtnText: { fontSize: 18, fontWeight: '900', color: C.inv, letterSpacing: 0.2 },
  disclaimer: { textAlign: 'center', color: C.t3, fontSize: 11, marginTop: 22, lineHeight: 17 },
  modalRoot: { flex: 1, backgroundColor: C.bg0 },
  modalHeader: { paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: C.t1 },
  modalSub: { fontSize: 12, color: C.t2, marginTop: 2 },
  modalClose: { width: 40, height: 40, borderRadius: R.md, backgroundColor: C.bg2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  modalCloseText: { color: C.t1, fontSize: 16, fontWeight: '700' },
  modalBar: { height: 3, backgroundColor: C.teal },
  webLoader: { position: 'absolute', top: '50%', left: '50%', marginTop: -20, marginLeft: -20 },
});
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal, Switch, Alert, ActivityIndicator } from 'react-native';
// ระวังตรงนี้: ตรวจสอบให้แน่ใจว่า import ไฟล์ supabase.js ถูกตำแหน่ง (อิงว่า supabase.js อยู่หน้าโฟลเดอร์ app)
import { supabase } from '../../supabase';

// --- กำหนดโครงสร้างข้อมูล (TypeScript Interfaces) ---
interface Item {
  id: string;
  name: string;
  list_type: 'weekly' | 'monthly';
  is_bought: boolean;
  purchase_history: { price: number; purchased_at: string }[];
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [isMonthly, setIsMonthly] = useState(false);

  // สำหรับ Modal กรอกราคา
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (session) fetchItems();
  }, [session]);

  // --- ระบบ Login & Logout ---
  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Login Failed', error.message);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- ดึงข้อมูลรายการของ ---
  const fetchItems = async () => {
    setLoading(true);
    // ดึงข้อมูลรายการ พร้อมดึงประวัติราคา 2 ครั้งล่าสุดมาด้วย
    const { data, error } = await supabase
      .from('items')
      .select('*, purchase_history(price, purchased_at)')
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error fetching items', error.message);
    } else {
      // จัดเรียงประวัติราคาจากใหม่ไปเก่า
      const formattedData = data?.map(item => ({
        ...item,
        purchase_history: item.purchase_history?.sort((a: any, b: any) => 
          new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
        )
      }));
      setItems(formattedData || []);
    }
    setLoading(false);
  };

  // --- เพิ่มรายการใหม่ ---
  const addItem = async () => {
    if (!newItemName.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('items').insert([
      { name: newItemName, list_type: isMonthly ? 'monthly' : 'weekly' }
    ]);
    if (error) Alert.alert('Error', error.message);
    else {
      setNewItemName('');
      fetchItems();
    }
    setLoading(false);
  };

  // --- ลบรายการ ---
  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) Alert.alert('Error', error.message);
    else fetchItems();
  };

  // --- ยืนยันการซื้อและบันทึกราคา ---
  const confirmPurchase = async () => {
    if (!priceInput || isNaN(Number(priceInput))) {
      Alert.alert('กรุณากรอกราคาให้ถูกต้อง');
      return;
    }
    
    setLoading(true);
    // 1. อัปเดตสถานะเป็น 'ซื้อแล้ว'
    await supabase.from('items').update({ is_bought: true }).eq('id', selectedItemId);
    
    // 2. บันทึกราคาลงประวัติ
    const { error } = await supabase.from('purchase_history').insert([
      { item_id: selectedItemId, price: Number(priceInput) }
    ]);

    if (error) Alert.alert('Error', error.message);
    else {
      setModalVisible(false);
      setPriceInput('');
      fetchItems();
    }
    setLoading(false);
  };

  // --- ฟังก์ชันคำนวณเปรียบเทียบราคา ---
  const getPriceComparison = (history: { price: number }[]) => {
    if (!history || history.length === 0) return <Text style={styles.noHistory}>ยังไม่มีประวัติราคา</Text>;
    if (history.length === 1) return <Text style={styles.historyText}>ซื้อล่าสุด: ฿{history[0].price}</Text>;

    const currentPrice = history[0].price;
    const previousPrice = history[1].price;
    const diff = currentPrice - previousPrice;

    if (diff > 0) return <Text style={styles.priceUp}>ซื้อล่าสุด: ฿{currentPrice} (แพงขึ้น ฿{diff} 🔺)</Text>;
    if (diff < 0) return <Text style={styles.priceDown}>ซื้อล่าสุด: ฿{currentPrice} (ถูกลง ฿{Math.abs(diff)} 🔻)</Text>;
    return <Text style={styles.historyText}>ซื้อล่าสุด: ฿{currentPrice} (ราคาเท่าเดิม)</Text>;
  };

  // --- หน้า Login UI ---
  if (!session) {
    return (
      <View style={styles.authContainer}>
        <Text style={styles.title}>BoughtYet? 🛒</Text>
        <Text style={styles.subtitle}>Family Login</Text>
        <TextInput style={styles.input} placeholder="Family Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Loading...' : 'เข้าสู่ระบบ'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- หน้า Main App UI ---
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>BoughtYet? 🛒</Text>
        <TouchableOpacity onPress={handleLogout}><Text style={styles.logoutText}>ออกจากระบบ</Text></TouchableOpacity>
      </View>

      {/* ฟอร์มเพิ่มรายการ */}
      <View style={styles.addForm}>
        <TextInput style={[styles.input, {flex: 1, marginBottom: 0}]} placeholder="ชื่อของที่ต้องซื้อ..." value={newItemName} onChangeText={setNewItemName} />
        <View style={styles.switchRow}>
          <Text>รายสัปดาห์</Text>
          <Switch value={isMonthly} onValueChange={setIsMonthly} />
          <Text>รายเดือน</Text>
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={addItem} disabled={loading}>
          <Text style={styles.buttonText}>เพิ่ม</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="large" color="#0000ff" />}

      {/* รายการของ */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.itemCard, item.is_bought && styles.itemBought]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name} <Text style={styles.badge}>{item.list_type}</Text></Text>
              {getPriceComparison(item.purchase_history)}
            </View>
            
            <View style={styles.actionRow}>
              {!item.is_bought && (
                <TouchableOpacity style={styles.buyButton} onPress={() => { setSelectedItemId(item.id); setModalVisible(true); }}>
                  <Text style={styles.buttonText}>ซื้อแล้ว</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.deleteButton} onPress={() => deleteItem(item.id)}>
                <Text style={styles.buttonText}>ลบ</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Modal กรอกราคา */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>กรอกราคาที่ซื้อ</Text>
            <TextInput style={styles.input} placeholder="ราคา (บาท)" keyboardType="numeric" value={priceInput} onChangeText={setPriceInput} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.primaryButton, {flex: 1, marginRight: 5}]} onPress={confirmPurchase}>
                <Text style={styles.buttonText}>ยืนยัน</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteButton, {flex: 1, marginLeft: 5}]} onPress={() => { setModalVisible(false); setPriceInput(''); }}>
                <Text style={styles.buttonText}>ยกเลิก</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- ตกแต่งความสวยงาม (Styles) ---
const styles = StyleSheet.create({
  authContainer: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5', paddingTop: 50 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 18, color: '#666', marginBottom: 20, textAlign: 'center' },
  logoutText: { color: 'red', fontWeight: 'bold' },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  addForm: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  primaryButton: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 8, alignItems: 'center' },
  buyButton: { backgroundColor: '#2196F3', padding: 10, borderRadius: 8, marginRight: 5 },
  deleteButton: { backgroundColor: '#f44336', padding: 10, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  itemCard: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemBought: { opacity: 0.6, backgroundColor: '#e8f5e9' },
  itemName: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  badge: { fontSize: 12, color: '#ff9800', backgroundColor: '#fff3e0', paddingHorizontal: 5, borderRadius: 4 },
  historyText: { fontSize: 14, color: '#666' },
  noHistory: { fontSize: 14, color: '#aaa', fontStyle: 'italic' },
  priceUp: { fontSize: 14, color: '#f44336', fontWeight: 'bold' },
  priceDown: { fontSize: 14, color: '#4CAF50', fontWeight: 'bold' },
  actionRow: { flexDirection: 'row' },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' }
});
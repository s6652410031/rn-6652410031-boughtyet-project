import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";

const supabaseUrl = "https://xhvuppjlimbanepcoexo.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhodnVwcGpsaW1iYW5lcGNvZXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTc4MzYsImV4cCI6MjA5Mjg3MzgzNn0.A0r23pTq1A7Bdi11SDi9TdOVpLcWBMVC21eqFmAtFNk"; // <<< อย่าลืมใส่คีย์ยาวๆ ของคุณกลับเข้าไปนะครับ

// สร้าง Custom Storage ที่เช็คความปลอดภัย ไม่ให้พังตอนรัน SSR บนเว็บ
const customStorage = {
  getItem: async (key) => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined")
        window.localStorage.setItem(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.removeItem(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

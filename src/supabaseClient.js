import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xhvuppjlimbanepcoexo.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhodnVwcGpsaW1iYW5lcGNvZXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTc4MzYsImV4cCI6MjA5Mjg3MzgzNn0.A0r23pTq1A7Bdi11SDi9TdOVpLcWBMVC21eqFmAtFNk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

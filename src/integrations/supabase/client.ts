import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 
  import.meta.env.VITE_SUPABASE_URL || "https://fvhjvphazrpanoqmsqvv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aGp2cGhhenJwYW5vcW1zcXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjQ4MjksImV4cCI6MjA4ODgwMDgyOX0.A9eu28EbxERdoUw1t-F3n_mjsO5TpOzoU7SCYT3696A";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
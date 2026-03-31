// core/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://lpeyttqmnziglyxnwjgi.supabase.co";
const supabaseKey = "YOUR_ANON_KEY_HERE";

export function getSupabaseClient(keepSignedIn = true) {
    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: keepSignedIn ? localStorage : sessionStorage
        }
    });
}

export const supabase = getSupabaseClient(true);
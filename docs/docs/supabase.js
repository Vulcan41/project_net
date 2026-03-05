// supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

const supabaseUrl = "https://lpeyttqmnziglyxnwjgi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZXl0dHFtbnppZ2x5eG53amdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjQ3MDcsImV4cCI6MjA4NzQ0MDcwN30.y-1bKw-XwguZxZPXyLVy1IOLoB8xtYfj1YE9gAj4qhs";

export const supabase = createClient(supabaseUrl, supabaseKey);
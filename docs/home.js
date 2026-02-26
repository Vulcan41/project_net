// home.js

import { supabase } from "./supabase.js";
import { loadProfile, setupSaveProfile } from "./user.js";

const welcome = document.getElementById("welcome");

/* ---------- SESSION CHECK ---------- */

const {
    data: { session }
} = await supabase.auth.getSession();

// Protect page
if (!session) {
    window.location.href = "index.html";
} else {
    welcome.innerText = "Welcome " + session.user.email;
}

/* ---------- LOGOUT ---------- */

window.logout = async function () {
    await supabase.auth.signOut();
    window.location.href = "index.html";
};

/* ---------- PAGE STARTUP ---------- */

loadProfile();
setupSaveProfile();
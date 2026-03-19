import { supabase } from "./core/supabase.js";
import { loadView } from "./core/router.js";
import { initHeader } from "./components/header.js";
import { userStore } from "./state/userStore.js";

await userStore.load();

/* =========================================================
   HEADER LOADER
========================================================= */

async function loadHeader() {

    const res = await fetch("./components/header.html");
    const html = await res.text();

    document.getElementById("header-container").innerHTML = html;

}

await loadHeader();

/* =========================================================
   SESSION CHECK
========================================================= */

const {
    data: { session }
} = await supabase.auth.getSession();

if (!session) {
    window.location.href = "index.html";
}

/* =========================================================
   GLOBAL REFERENCES
========================================================= */

const homeBtn = document.getElementById("home-btn");
const friendsBtn = document.getElementById("friends-btn");
const messagesBtn = document.getElementById("messages-btn");
const notificationsBtn = document.getElementById("notifications-btn");
const settingsBtn = document.getElementById("settings-btn");

/* =========================================================
   HEADER NAVIGATION
========================================================= */

homeBtn?.addEventListener("click", () => loadView("basic"));
friendsBtn?.addEventListener("click", () => loadView("friends"));
messagesBtn?.addEventListener("click", () => loadView("messages"));
notificationsBtn?.addEventListener("click", () => loadView("notifications"));
settingsBtn?.addEventListener("click", () => loadView("settings"));

/* =========================================================
   INIT HEADER COMPONENT
========================================================= */

initHeader();

/* =========================================================
   INITIAL VIEW
========================================================= */

loadView("basic");
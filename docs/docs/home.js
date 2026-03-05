import { supabase } from "./supabase.js";

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

const main = document.getElementById("main-content");
const homeBtn = document.getElementById("home-btn");
const friendsBtn = document.getElementById("friends-btn");
const messagesBtn = document.getElementById("messages-btn");
const notificationsBtn = document.getElementById("notifications-btn");
const settingsBtn = document.getElementById("settings-btn");
const userBtn = document.getElementById("user-btn");

/* =========================================================
   VIEW LOADER
========================================================= */

async function loadView(name) {

    try {

        const response = await fetch(`views/${name}/${name}.html`);

        if (!response.ok) {
            console.error("View not found:", name);
            return;
        }

        const html = await response.text();

        main.innerHTML = html;

        const module = await import(`./views/${name}/${name}.js`);

        if (module.initView) {
            module.initView();
        }

    } catch (error) {
        console.error("Error loading view:", error);
    }

}

/* =========================================================
   LOAD HEADER USERNAME
========================================================= */

async function loadHeaderUser() {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const usernameEl = document.getElementById("user-name");

    if (usernameEl) {
        usernameEl.textContent = user.email;
    }

}

loadHeaderUser();

/* =========================================================
   LOAD CREDITS
========================================================= */

async function loadCredits() {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error("Credits error:", error);
        return;
    }

    const creditsEl = document.getElementById("credits-value");

    if (creditsEl) {
        creditsEl.textContent = profile?.credits ?? 0;
    }

}

loadCredits();

/* =========================================================
   HEADER BUTTON EVENTS
========================================================= */

homeBtn?.addEventListener("click", () => {
    loadView("basic");
});

friendsBtn?.addEventListener("click", () => {
    loadView("friends");
});

messagesBtn?.addEventListener("click", () => {
    loadView("messages");
});

notificationsBtn?.addEventListener("click", () => {
    loadView("notifications");
});

settingsBtn?.addEventListener("click", () => {
    loadView("settings");
});

/* =========================================================
   LOGOUT MODAL REFERENCES
========================================================= */

const modal = document.getElementById("logout-modal");
const cancelBtn = document.getElementById("cancel-logout");
const confirmBtn = document.getElementById("confirm-logout");

/* =========================================================
   USER DROPDOWN
========================================================= */

const userDropdown = document.getElementById("user-dropdown");
const dropdownProfile = document.getElementById("dropdown-profile");
const dropdownLogout = document.getElementById("dropdown-logout");

userBtn?.addEventListener("click", (e) => {

    e.stopPropagation();
    userDropdown.classList.toggle("dropdown-hidden");

});

userDropdown?.addEventListener("click", (e) => {
    e.stopPropagation();
});

/* Open profile view */

dropdownProfile?.addEventListener("click", () => {

    userDropdown.classList.add("dropdown-hidden");

    loadView("profile");

});

/* Open logout modal */

dropdownLogout?.addEventListener("click", (e) => {

    e.stopPropagation();

    userDropdown.classList.add("dropdown-hidden");

    modal.classList.remove("modal-hidden");

});

/* Close dropdown when clicking outside */

document.addEventListener("click", () => {

    userDropdown.classList.add("dropdown-hidden");

});

/* =========================================================
   LOGOUT MODAL
========================================================= */

cancelBtn?.addEventListener("click", () => {

    modal.classList.add("modal-hidden");

});

confirmBtn?.addEventListener("click", async () => {

    await supabase.auth.signOut();

    window.location.href = "index.html";

});

/* =========================================================
   INITIAL VIEW LOAD
========================================================= */

loadView("basic");
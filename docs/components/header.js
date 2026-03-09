import { supabase } from "../core/supabase.js";
import { loadView } from "../core/router.js";
import { userStore } from "../state/userStore.js";
import { DEFAULT_AVATAR, DEFAULT_FULLNAME, DEFAULT_USERNAME, DEFAULT_BIO } from "../state/userStore.js";


/* =========================================================
   INIT HEADER
========================================================= */

export async function initHeader() {

    loadHeaderUser();
    await loadCredits();

    setupNavigation();
    setupDropdown();
    setupLogoutModal();
    setupSearch();

}

/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    const homeBtn = document.getElementById("home-btn");
    const friendsBtn = document.getElementById("friends-btn");
    const messagesBtn = document.getElementById("messages-btn");
    const notificationsBtn = document.getElementById("notifications-btn");
    const settingsBtn = document.getElementById("settings-btn");
    const debugBtn = document.getElementById("debug-btn");

    homeBtn?.addEventListener("click", () => loadView("basic"));
    friendsBtn?.addEventListener("click", () => loadView("friends"));
    messagesBtn?.addEventListener("click", () => loadView("messages"));
    notificationsBtn?.addEventListener("click", () => loadView("notifications"));
    settingsBtn?.addEventListener("click", () => loadView("settings"));
    debugBtn?.addEventListener("click", () => loadView("debug"));

}

/* =========================================================
   LOAD HEADER USERNAME + AVATAR
========================================================= */

function loadHeaderUser() {

    const profile = userStore.getProfile();
    if (!profile) return;

    const nameEl = document.getElementById("user-name");
    const avatarEl = document.querySelector("#user-btn img");

    if (avatarEl) {

        avatarEl.src =
        profile.avatar_url && profile.avatar_url.trim() !== ""
        ? profile.avatar_url
        : DEFAULT_AVATAR;

        avatarEl.onerror = () => {
            avatarEl.src = DEFAULT_AVATAR;
        };

    }

    if (nameEl) {
        nameEl.textContent = profile.username || DEFAULT_USERNAME;
    }

}

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
        console.error("Credits load failed:", error);
        return;
    }

    const creditsEl = document.getElementById("credits-value");

    if (creditsEl) {
        creditsEl.textContent = profile.credits ?? 0;
    }

}

/* =========================================================
   USER DROPDOWN
========================================================= */

function setupDropdown() {

    const wrapper = document.querySelector(".user-wrapper");
    const dropdown = document.getElementById("user-dropdown");

    const dropdownProfile = document.getElementById("dropdown-profile");
    const dropdownLogout = document.getElementById("dropdown-logout");

    if (!wrapper || !dropdown) return;

    let hideTimer;

    wrapper.addEventListener("mouseenter", () => {

        clearTimeout(hideTimer);
        dropdown.classList.remove("dropdown-hidden");

    });

    wrapper.addEventListener("mouseleave", () => {

        hideTimer = setTimeout(() => {
            dropdown.classList.add("dropdown-hidden");
        }, 120);

    });

    dropdownProfile?.addEventListener("click", () => {

        dropdown.classList.add("dropdown-hidden");
        loadView("profile");

    });

    dropdownLogout?.addEventListener("click", (e) => {

        e.stopPropagation();
        dropdown.classList.add("dropdown-hidden");

        const modal = document.getElementById("logout-modal");
        modal?.classList.remove("modal-hidden");

    });

}

/* =========================================================
   LOGOUT MODAL
========================================================= */

function setupLogoutModal() {

    const modal = document.getElementById("logout-modal");
    const cancelBtn = document.getElementById("cancel-logout");
    const confirmBtn = document.getElementById("confirm-logout");

    cancelBtn?.addEventListener("click", () => {

        modal?.classList.add("modal-hidden");

    });

    confirmBtn?.addEventListener("click", async () => {

        await supabase.auth.signOut();
        window.location.href = "index.html";

    });

}

/* =========================================================
   SEARCH LOGIC
========================================================= */

function setupSearch() {

    const input = document.getElementById("search-input");
    const results = document.getElementById("search-results");

    if (!input || !results) return;

    let timer;

    input.addEventListener("input", () => {

        clearTimeout(timer);

        timer = setTimeout(async () => {

            const query = input.value.trim();

            if (!query) {
                results.style.display = "none";
                results.innerHTML = "";
                return;
            }

            const { data } = await supabase
                .from("profiles")
                .select("id, username, full_name, avatar_url")
                .or(
                `username.ilike.${query}%,username.ilike.%${query}%,full_name.ilike.%${query}%`
            )
                .limit(10);

            results.innerHTML = "";

            if (!data || data.length === 0) {

                const div = document.createElement("div");
                div.className = "search-result-empty";
                div.textContent = "No results";

                results.appendChild(div);
                results.style.display = "block";
                return;

            }

            data.forEach(user => {

                const div = document.createElement("div");
                div.className = "search-result";

                const avatar = document.createElement("img");
                avatar.className = "search-avatar";
                avatar.src = user.avatar_url || DEFAULT_AVATAR;

                const textContainer = document.createElement("div");
                textContainer.className = "search-text";

                const name = document.createElement("div");
                name.className = "search-name";
                name.textContent = user.full_name || "User";

                const username = document.createElement("div");
                username.className = "search-username";
                username.textContent = "@" + user.username;

                textContainer.appendChild(name);
                textContainer.appendChild(username);

                div.appendChild(avatar);
                div.appendChild(textContainer);

                div.addEventListener("click", () => {

                    results.style.display = "none";
                    input.value = "";

                    loadView("profileOther", user.id);

                });

                results.appendChild(div);

            });

            results.style.display = "block";

        }, 300);

    });

    /* CLOSE ON OUTSIDE CLICK */

    document.addEventListener("click", (e) => {

        if (!e.target.closest("#header-search")) {
            results.style.display = "none";
        }

    });

}






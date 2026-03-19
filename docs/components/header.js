import { supabase } from "../core/supabase.js";
import { loadView } from "../core/router.js";
import { userStore } from "../state/userStore.js";
import { DEFAULT_AVATAR, DEFAULT_FULLNAME, DEFAULT_USERNAME, DEFAULT_BIO } from "../state/userStore.js";
import { initModal, openModal } from "../components/modal.js";


/* =========================================================
   INIT HEADER
========================================================= */

export async function initHeader() {

    await initModal();

    loadHeaderUser();
    await loadCredits();

    await checkFriendRequests();
    await checkNotifications();
    await checkMessages();

    listenFriendRequests();
    listenMessages();

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
    const cloudBtn = document.getElementById("cloud-btn");

    homeBtn?.addEventListener("click", () => loadView("basic"));
    friendsBtn?.addEventListener("click", () => {
        loadView("friends");
        const dot = document.getElementById("friends-dot");
        if (dot) dot.classList.add("hidden");
    });

    messagesBtn?.addEventListener("click", () => {

        loadView("messages");

        const dot = document.getElementById("messages-dot");
        if (dot) dot.classList.add("hidden");

    });

    notificationsBtn?.addEventListener("click", () => {

        loadView("notifications");

        const dot = document.getElementById("notifications-dot");
        if (dot) dot.classList.add("hidden");

    });

    settingsBtn?.addEventListener("click", () => loadView("settings"));
    debugBtn?.addEventListener("click", () => loadView("debug"));
    cloudBtn?.addEventListener("click", () => loadView("cloud"));

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

            const [profilesResponse, projectsResponse] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("id, username, full_name, avatar_url")
                    .or(
                    `username.ilike.${query}%,username.ilike.%${query}%,full_name.ilike.%${query}%`
                )
                    .limit(10),

                supabase
                    .from("projects")
                    .select("id, name, description, visibility, owner_id")
                    .eq("visibility", "public")
                    .or(
                    `name.ilike.${query}%,name.ilike.%${query}%,description.ilike.%${query}%`
                )
                    .limit(10)
            ]);

            const { data: profileData, error: profilesError } = profilesResponse;
            const { data: projectData, error: projectsError } = projectsResponse;

            if (profilesError) {
                console.error("Profile search failed:", profilesError);
            }

            if (projectsError) {
                console.error("Project search failed:", projectsError);
            }

            results.innerHTML = "";

            const hasProfiles = profileData && profileData.length > 0;
            const hasProjects = projectData && projectData.length > 0;

            if (!hasProfiles && !hasProjects) {

                const div = document.createElement("div");
                div.className = "search-result-empty";
                div.textContent = "No results";

                results.appendChild(div);
                results.style.display = "block";
                return;

            }

            /* =========================
               PROFILE RESULTS
            ========================= */

            if (hasProfiles) {

                const sectionTitle = document.createElement("div");
                sectionTitle.className = "search-section-title";
                sectionTitle.textContent = "Users";
                results.appendChild(sectionTitle);

                profileData.forEach(user => {

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

                        const currentUser = userStore.getUser();

                        if (currentUser && user.id === currentUser.id) {
                            loadView("profile");
                        } else {
                            loadView("profileOther", user.id);
                        }

                    });

                    results.appendChild(div);

                });
            }

            /* =========================
               PROJECT RESULTS
            ========================= */

            if (hasProjects) {

                const sectionTitle = document.createElement("div");
                sectionTitle.className = "search-section-title";
                sectionTitle.textContent = "Projects";
                results.appendChild(sectionTitle);

                projectData.forEach(project => {

                    const div = document.createElement("div");
                    div.className = "search-result";

                    const badge = document.createElement("div");
                    badge.className = "search-project-badge";
                    badge.textContent = (project.name || "P").charAt(0).toUpperCase();

                    const textContainer = document.createElement("div");
                    textContainer.className = "search-text";

                    const name = document.createElement("div");
                    name.className = "search-name";
                    name.textContent = project.name || "Untitled project";

                    const subtitle = document.createElement("div");
                    subtitle.className = "search-username";
                    subtitle.textContent = project.description || "Public project";

                    textContainer.appendChild(name);
                    textContainer.appendChild(subtitle);

                    div.appendChild(badge);
                    div.appendChild(textContainer);

                    div.addEventListener("click", async () => {
                        results.style.display = "none";
                        input.value = "";

                        const currentUser = userStore.getUser();

                        if (currentUser && project.owner_id === currentUser.id) {
                            loadView("project", project.id);
                            return;
                        }

                        if (!currentUser) {
                            loadView("projectOther", project.id);
                            return;
                        }

                        const { data, error } = await supabase
                            .from("project_members")
                            .select("membership_status")
                            .eq("project_id", project.id)
                            .eq("user_id", currentUser.id)
                            .maybeSingle();

                        if (error) {
                            console.error("Membership check failed:", error);
                            loadView("projectOther", project.id);
                            return;
                        }

                        if (data && data.membership_status === "active") {
                            loadView("projectMember", project.id);
                        } else {
                            loadView("projectOther", project.id);
                        }
                    });

                    results.appendChild(div);

                });
            }

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

/* =========================================================
   FRIEND REQUEST INDICATOR
========================================================= */

async function checkFriendRequests() {

    const dot = document.getElementById("friends-dot");
    if (!dot) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count, error } = await supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("status", "pending");

    if (error) {
        console.error("Friend request check failed:", error);
        return;
    }

    if (count > 0) {
        dot.classList.remove("hidden");
    } else {
        dot.classList.add("hidden");
    }

}

/* =========================================================
   NOTIFICATION INDICATOR
========================================================= */

async function checkNotifications() {

    const dot = document.getElementById("notifications-dot");
    if (!dot) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .gte("created_at", new Date(Date.now() - 86400000).toISOString());

    if (error) {
        console.error("Notification check failed:", error);
        return;
    }

    if (count > 0) {
        dot.classList.remove("hidden");
    } else {
        dot.classList.add("hidden");
    }

}

/* =========================================================
   REALTIME FRIEND REQUEST LISTENER
========================================================= */

function listenFriendRequests() {

    supabase
        .channel("friend-request-listener")

        .on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "friendships"
        },

        async (payload) => {

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const newRequest = payload.new;

            /* check if YOU are the receiver */

            if (
            newRequest.receiver_id === user.id &&
            newRequest.status === "pending"
            ) {
                checkFriendRequests();
            }

        }

    )
        .subscribe();

}


/* =========================================================
   LOGOUT MODAL
========================================================= */


function setupLogoutModal() {

    const dropdownLogout = document.getElementById("dropdown-logout");

    dropdownLogout?.addEventListener("click", (e) => {
        e.stopPropagation();

        const dropdown = document.getElementById("user-dropdown");
        dropdown?.classList.add("dropdown-hidden");

        openModal({
            message: "Είστε σίγουροι ότι θέλετε να αποσυνδεθείτε;",
            cancelText: "Ακύρωση",
            confirmText: "Αποσύνδεση",
            onConfirm: async () => {
                await supabase.auth.signOut();
                window.location.href = "index.html";
            }
        });
    });

}

/* =========================================================
   MESSAGE INDICATOR
========================================================= */

async function checkMessages() {

    const dot = document.getElementById("messages-dot");
    if (!dot) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from("messages")
        .select(`
            id,
            created_at,
            conversation:conversation_id (
                id,
                last_read_at
            )
        `);

    if (error) {
        console.error("Message check failed:", error);
        return;
    }

    const hasUnread = data.some(msg => {

        const lastRead = msg.conversation?.last_read_at;

        if (!lastRead) return true;

        return new Date(msg.created_at) > new Date(lastRead);

    });

    if (hasUnread) {
        dot.classList.remove("hidden");
    } else {
        dot.classList.add("hidden");
    }

}

function listenMessages() {

    supabase
        .channel("message-listener")
        .on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "messages"
        },
        async (payload) => {

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const newMessage = payload.new;

            if (newMessage.sender_id !== user.id) {
                checkMessages();
            }

        }
    )
        .subscribe();
}






import { supabase } from "../../core/supabase.js";
import { loadView } from "../../core/router.js";
import { userStore } from "../../state/userStore.js";
import { DEFAULT_AVATAR } from "../../state/userStore.js";

export async function initSearch() {
    await ensureSearchComponent();
    setupSearch();
}

async function ensureSearchComponent() {
    const slot = document.getElementById("search-slot");
    if (!slot) return;

    if (!document.getElementById("header-search")) {
        const res = await fetch("./components/search/search.html");
        const html = await res.text();
        slot.innerHTML = html;
    }

    if (!document.getElementById("search-component-css")) {
        const link = document.createElement("link");
        link.id = "search-component-css";
        link.rel = "stylesheet";
        link.href = "./components/search/search.css";
        document.head.appendChild(link);
    }
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
                    .select("id, name, description, visibility, owner_id, avatar_url, members_count")
                    .eq("visibility", "public")
                    .or(
                    `name.ilike.${query}%,name.ilike.%${query}%,description.ilike.%${query}%`
                )
                    .limit(10)
            ]);

            const { data: profileData, error: profilesError } = profilesResponse;
            const { data: projectData, error: projectsError } = projectsResponse;

            if (profilesError) console.error("Profile search failed:", profilesError);
            if (projectsError) console.error("Project search failed:", projectsError);

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

            if (hasProjects) {
                const sectionTitle = document.createElement("div");
                sectionTitle.className = "search-section-title";
                sectionTitle.textContent = "Projects";
                results.appendChild(sectionTitle);

                projectData.forEach(project => {
                    const div = document.createElement("div");
                    div.className = "search-result";

                    const avatarWrap = document.createElement("div");
                    avatarWrap.className = "search-project-avatar";

                    if (project.avatar_url && project.avatar_url.trim() !== "") {
                        const img = document.createElement("img");
                        img.className = "search-project-avatar-image";
                        img.src = project.avatar_url;

                        img.onerror = () => {
                            avatarWrap.innerHTML = "";
                            const fallback = document.createElement("div");
                            fallback.className = "search-project-badge";
                            fallback.textContent = (project.name || "P").charAt(0).toUpperCase();
                            avatarWrap.appendChild(fallback);
                        };

                        avatarWrap.appendChild(img);
                    } else {
                        const fallback = document.createElement("div");
                        fallback.className = "search-project-badge";
                        fallback.textContent = (project.name || "P").charAt(0).toUpperCase();
                        avatarWrap.appendChild(fallback);
                    }

                    const textContainer = document.createElement("div");
                    textContainer.className = "search-text";

                    const name = document.createElement("div");
                    name.className = "search-name";
                    name.textContent = project.name || "Untitled project";

                    const subtitle = document.createElement("div");
                    subtitle.className = "search-username";

                    const membersCount = project.members_count ?? 1;
                    subtitle.textContent = `${membersCount} ${membersCount === 1 ? "member" : "members"}`;

                    textContainer.appendChild(name);
                    textContainer.appendChild(subtitle);

                    div.appendChild(avatarWrap);
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

    document.addEventListener("click", (e) => {
        if (!e.target.closest("#header-search")) {
            results.style.display = "none";
        }
    });
}
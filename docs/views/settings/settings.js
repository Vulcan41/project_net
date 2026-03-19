/* =========================
   TAB CONFIGURATION
========================= */

const SETTINGS_TABS = {
    profile: {
        html: "./views/settings/settingsProfile.html",
        css: "./views/settings/settingsProfile.css",
        js: "./settingsProfile.js",
        init: "initSettingsProfilePanel"
    }
};

/* =========================
   PANEL LOADERS
========================= */

async function loadSettingsPanelHtml(filePath) {
    const host = document.getElementById("settings-panel-host");
    if (!host) return false;

    try {
        const response = await fetch(filePath);

        if (!response.ok) {
            throw new Error(`Failed to load ${filePath}`);
        }

        const html = await response.text();
        host.innerHTML = html;

        return true;

    } catch (error) {

        console.error("Settings panel load failed:", error);

        host.innerHTML = `
            <div class="settings-panel active">
                <p>Αποτυχία φόρτωσης περιεχομένου.</p>
            </div>
        `;

        return false;
    }
}

async function loadSettingsPanelScript(filePath) {
    try {
        const module = await import(filePath);
        return module;
    } catch (error) {
        console.error("Settings panel script load failed:", error);
        return null;
    }
}

function loadSettingsPanelCss(filePath) {

    const existing = document.getElementById("settings-panel-css");
    if (existing) existing.remove();

    const link = document.createElement("link");

    link.id = "settings-panel-css";
    link.rel = "stylesheet";
    link.href = filePath;

    document.head.appendChild(link);
}

/* =========================
   INIT
========================= */

export function initSettings() {

    const requestedTab =
    sessionStorage.getItem("settingsActiveTab") || "profile";

    sessionStorage.removeItem("settingsActiveTab");

    bindSettingsTabs(requestedTab);
}

/* =========================
   TABS
========================= */

function bindSettingsTabs(initialTab = "profile") {

    const buttons = document.querySelectorAll(".settings-menu-btn");

    const activateTab = async (tab) => {

        buttons.forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.tab === tab
            );
        });

        const tabConfig = SETTINGS_TABS[tab];

        /* =========================
           MODULE TAB
        ========================= */

        if (tabConfig) {

            if (tabConfig.css) {
                loadSettingsPanelCss(tabConfig.css);
            }

            const htmlLoaded =
            await loadSettingsPanelHtml(tabConfig.html);

            if (!htmlLoaded) return;

            if (tabConfig.js) {

                const module =
                await loadSettingsPanelScript(tabConfig.js);

                if (module && module[tabConfig.init]) {
                    module[tabConfig.init]();
                } else {
                    console.error(
                        `Init function ${tabConfig.init} not found`
                    );
                }
            }

            return;
        }

        /* =========================
           FALLBACK TAB
        ========================= */

        const host = document.getElementById("settings-panel-host");
        if (!host) return;

        host.innerHTML = `
            <div class="settings-panel active">
                <h2>${getTabTitle(tab)}</h2>
                <p>Το περιεχόμενο αυτής της ενότητας θα προστεθεί σύντομα.</p>
            </div>
        `;
    };

    buttons.forEach(button => {
        button.onclick = () => {
            activateTab(button.dataset.tab);
        };
    });

    activateTab(initialTab);
}

/* =========================
   TAB TITLES
========================= */

function getTabTitle(tab) {

    switch (tab) {

        case "profile":
            return "Προφίλ";

        case "friends":
            return "Επαφές";

        case "messages":
            return "Μηνύματα";

        case "notifications":
            return "Ειδοποιήσεις";

        case "account":
            return "Λογαριασμός";

        case "privacy":
            return "Ιδιωτικότητα";

        case "appearance":
            return "Εμφάνιση";

        default:
            return "Ρυθμίσεις";
    }
}
let infoHideTimeout = null;
let infoCssLoaded = false;
let infoHtmlLoaded = false;

function ensureInfoCss() {
    if (infoCssLoaded) return;

    const existing = document.getElementById("app-info-style");
    if (existing) {
        infoCssLoaded = true;
        return;
    }

    const link = document.createElement("link");
    link.id = "app-info-style";
    link.rel = "stylesheet";
    link.href = "./components/info.css";

    document.head.appendChild(link);
    infoCssLoaded = true;
}

async function ensureInfoHtml() {
    if (document.getElementById("app-info")) {
        infoHtmlLoaded = true;
        return true;
    }

    try {
        const response = await fetch("./components/info.html");

        if (!response.ok) {
            throw new Error(`Failed to load info.html`);
        }

        const html = await response.text();

        const wrapper = document.createElement("div");
        wrapper.innerHTML = html.trim();

        const element = wrapper.firstElementChild;
        if (!element) return false;

        document.body.appendChild(element);

        infoHtmlLoaded = true;
        return true;

    } catch (error) {
        console.error("Info component HTML load failed:", error);
        return false;
    }
}

function getInfoElements() {
    return {
        root: document.getElementById("app-info"),
        icon: document.getElementById("app-info-icon"),
        title: document.getElementById("app-info-title"),
        message: document.getElementById("app-info-message")
    };
}

function getTypeMeta(type) {
    switch (type) {
        case "success":
            return {
                title: "Επιτυχία",
                icon: "✓"
            };

        case "error":
            return {
                title: "Σφάλμα",
                icon: "!"
            };

        case "warning":
            return {
                title: "Προσοχή",
                icon: "!"
            };

        case "info":
        default:
            return {
                title: "Ενημέρωση",
                icon: "i"
            };
    }
}

export async function showInfo({
    message = "",
    type = "info",
    title,
    duration = 2200
} = {}) {
    ensureInfoCss();

    const htmlReady = await ensureInfoHtml();
    if (!htmlReady) return;

    const { root, icon, title: titleEl, message: messageEl } = getInfoElements();
    if (!root || !icon || !titleEl || !messageEl) return;

    const meta = getTypeMeta(type);

    root.classList.remove("success", "error", "warning", "info", "show");
    root.classList.add(type);

    icon.textContent = meta.icon;
    titleEl.textContent = title || meta.title;
    messageEl.textContent = message;

    root.setAttribute("aria-hidden", "false");

    if (infoHideTimeout) {
        clearTimeout(infoHideTimeout);
        infoHideTimeout = null;
    }

    requestAnimationFrame(() => {
        root.classList.add("show");
    });

    infoHideTimeout = window.setTimeout(() => {
        hideInfo();
    }, duration);
}

export function hideInfo() {
    const root = document.getElementById("app-info");
    if (!root) return;

    root.classList.remove("show");
    root.setAttribute("aria-hidden", "true");

    if (infoHideTimeout) {
        clearTimeout(infoHideTimeout);
        infoHideTimeout = null;
    }
}
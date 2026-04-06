const routes = {

    basic: "basic",
    friends: "friends",
    messages: "messages",
    notifications: "notifications",
    settings: "settings",
    profile: "profile",
    debug: "debug",
    profileEdit: "profileEdit",
    profileOther: "profileOther",
    testCloud: "testCloud",
    cloud: "cloud",
    project: "project",
    projectMember: "projectMember",
    projectOther: "projectOther"

};

export async function loadView(name, param = null) {

    const folder = routes[name];

    if (!folder) {
        console.error("View not found:", name);
        return;
    }

    const htmlPath = `./views/${folder}/${folder}.html`;
    const jsPath = `../views/${folder}/${folder}.js`;
    const cssPath = `./views/${folder}/${folder}.css`;

    /* ===============================
       LOAD HTML
    =============================== */

    const res = await fetch(htmlPath);
    const html = await res.text();

    document.getElementById("main-content").innerHTML = html;

    /* ===============================
       LOAD CSS
    =============================== */

    const oldCss = document.getElementById("view-css");
    if (oldCss) oldCss.remove();

    const link = document.createElement("link");
    link.id = "view-css";
    link.rel = "stylesheet";
    link.href = cssPath;

    document.head.appendChild(link);

    /* ===============================
       LOAD JS
    =============================== */

    try {

        const module = await import(/* @vite-ignore */ jsPath);

        const initFunction =
        "init" + folder.charAt(0).toUpperCase() + folder.slice(1);

        if (module[initFunction]) {
            module[initFunction](param);   // ← FIX
        }

    } catch (err) {

        console.error("Router JS load error:", err);

    }

}
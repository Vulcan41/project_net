export function initView() {

    const buttons = document.querySelectorAll(".basic-menu-btn");
    const content = document.getElementById("basic-content");

    buttons.forEach(btn => {

        btn.addEventListener("click", () => {

            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const section = btn.dataset.section;

            switch (section) {

                case "overview":
                    content.innerHTML = BasicOverviewSection();
                    break;

                case "projects":
                    content.innerHTML = BasicProjectsSection();
                    break;

                case "activity":
                    content.innerHTML = BasicActivitySection();
                    break;

            }

        });

    });

}

/* =========================================================
   SECTIONS
========================================================= */

function BasicOverviewSection() {

    return `
        <h2>Overview</h2>
        <p>This is the overview section.</p>
    `;

}

function BasicProjectsSection() {

    return `
        <h2>Projects</h2>
        <p>Project list will appear here.</p>
    `;

}

function BasicActivitySection() {

    return `
        <h2>Activity</h2>
        <p>Recent activity will appear here.</p>
    `;

}
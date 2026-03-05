const buttons = document.querySelectorAll(".settings-menu-btn")
const container = document.getElementById("settings-content")

async function loadSection(section) {

    // load HTML
    const res = await fetch(`views/settings/tabs/${section}.html`)
    const html = await res.text()

    container.innerHTML = html

    // load optional JS
    try {

        const module = await import(`views/settings/tabs/${section}.js`)

        if (module.init) {
            module.init()
        }

    } catch (err) {}

}

buttons.forEach(btn => {

    btn.addEventListener("click", () => {

        const section = btn.dataset.section

        buttons.forEach(b => b.classList.remove("active"))
        btn.classList.add("active")

        loadSection(section)

    })

})

// load default tab
document.querySelector(".settings-menu-btn.active").click()
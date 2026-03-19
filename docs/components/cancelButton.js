export function createCancelButton({
    label = "Αφαίρεση",
    text = "×",
    className = "",
    onClick = null
} = {}) {

    const btn = document.createElement("button");

    btn.type = "button";
    btn.className = `cancel-icon-btn ${className}`.trim();
    btn.textContent = text;

    /* custom tooltip */

    btn.setAttribute("data-tooltip", label);
    btn.setAttribute("aria-label", label);

    if (typeof onClick === "function") {
        btn.addEventListener("click", onClick);
    }

    return btn;
}
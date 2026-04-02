let lightboxInitialized = false;
let lightboxItems = [];
let lightboxIndex = 0;
let isLightboxClosing = false;

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function createLightboxMarkup() {
    return `
        <div id="lightbox-modal" class="lightbox-modal hidden">
            <div id="lightbox-backdrop" class="lightbox-backdrop"></div>

            <div class="lightbox-content">
                <button id="lightbox-close-btn" class="lightbox-close-btn" type="button" aria-label="Close">
                    ×
                </button>

                <button id="lightbox-prev-btn" class="lightbox-nav-btn lightbox-prev-btn" type="button" aria-label="Previous image">
                    ‹
                </button>

                <div class="lightbox-image-wrap">
                    <img id="lightbox-image" class="lightbox-image" alt="" />

                    <a id="lightbox-download-btn" class="lightbox-download-btn" href="#" download>
                        Download
                    </a>
                </div>

                <button id="lightbox-next-btn" class="lightbox-nav-btn lightbox-next-btn" type="button" aria-label="Next image">
                    ›
                </button>

                <div id="lightbox-counter" class="lightbox-counter hidden"></div>
            </div>
        </div>
    `;
}

function renderLightboxImage() {
    const image = document.getElementById("lightbox-image");
    const prevBtn = document.getElementById("lightbox-prev-btn");
    const nextBtn = document.getElementById("lightbox-next-btn");
    const counter = document.getElementById("lightbox-counter");
    const downloadBtn = document.getElementById("lightbox-download-btn");

    if (!image) return;
    if (!lightboxItems.length) return;

    const currentItem = lightboxItems[lightboxIndex];
    image.src = currentItem.src;
    image.alt = currentItem.alt || "";

    if (downloadBtn) {
        downloadBtn.href = currentItem.src;
        downloadBtn.setAttribute("download", currentItem.alt || "image");
    }

    const shouldShowNav = lightboxItems.length > 1;

    if (prevBtn) {
        prevBtn.classList.toggle("hidden", !shouldShowNav);
    }

    if (nextBtn) {
        nextBtn.classList.toggle("hidden", !shouldShowNav);
    }

    if (counter) {
        if (shouldShowNav) {
            counter.textContent = `${lightboxIndex + 1} / ${lightboxItems.length}`;
            counter.classList.remove("hidden");
        } else {
            counter.textContent = "";
            counter.classList.add("hidden");
        }
    }
}

function showPreviousLightboxImage() {
    if (lightboxItems.length <= 1) return;

    lightboxIndex = (lightboxIndex - 1 + lightboxItems.length) % lightboxItems.length;
    renderLightboxImage();
}

function showNextLightboxImage() {
    if (lightboxItems.length <= 1) return;

    lightboxIndex = (lightboxIndex + 1) % lightboxItems.length;
    renderLightboxImage();
}

function resetTouchState() {
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
}

function handleTouchStart(e) {
    if (lightboxItems.length <= 1) return;

    const touch = e.changedTouches?.[0];
    if (!touch) return;

    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchEndX = touch.clientX;
    touchEndY = touch.clientY;
}

function handleTouchMove(e) {
    if (lightboxItems.length <= 1) return;

    const touch = e.changedTouches?.[0];
    if (!touch) return;

    touchEndX = touch.clientX;
    touchEndY = touch.clientY;
}

function handleTouchEnd() {
    if (lightboxItems.length <= 1) return;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    const minSwipeDistance = 50;

    if (absX < minSwipeDistance) {
        resetTouchState();
        return;
    }

    if (absX <= absY) {
        resetTouchState();
        return;
    }

    if (deltaX < 0) {
        showNextLightboxImage();
    } else {
        showPreviousLightboxImage();
    }

    resetTouchState();
}

function finishLightboxClose() {
    const modal = document.getElementById("lightbox-modal");
    const image = document.getElementById("lightbox-image");
    const counter = document.getElementById("lightbox-counter");
    const downloadBtn = document.getElementById("lightbox-download-btn");

    if (!modal || !image) return;

    modal.classList.add("hidden");
    modal.classList.remove("is-closing");

    image.src = "";
    image.alt = "";

    if (counter) {
        counter.textContent = "";
        counter.classList.add("hidden");
    }

    if (downloadBtn) {
        downloadBtn.href = "#";
        downloadBtn.removeAttribute("download");
    }

    lightboxItems = [];
    lightboxIndex = 0;
    isLightboxClosing = false;
    resetTouchState();
    document.body.classList.remove("lightbox-open");
}

export function initLightboxModal() {
    if (lightboxInitialized) return;

    let modal = document.getElementById("lightbox-modal");

    if (!modal) {
        document.body.insertAdjacentHTML("beforeend", createLightboxMarkup());
        modal = document.getElementById("lightbox-modal");
    }

    const backdrop = document.getElementById("lightbox-backdrop");
    const closeBtn = document.getElementById("lightbox-close-btn");
    const prevBtn = document.getElementById("lightbox-prev-btn");
    const nextBtn = document.getElementById("lightbox-next-btn");
    const image = document.getElementById("lightbox-image");

    if (backdrop) {
        backdrop.addEventListener("click", closeLightboxModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", closeLightboxModal);
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", showPreviousLightboxImage);
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", showNextLightboxImage);
    }

    if (image) {
        image.addEventListener("touchstart", handleTouchStart, { passive: true });
        image.addEventListener("touchmove", handleTouchMove, { passive: true });
        image.addEventListener("touchend", handleTouchEnd, { passive: true });

        image.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    }

    document.addEventListener("keydown", (e) => {
        const modalEl = document.getElementById("lightbox-modal");
        if (!modalEl || modalEl.classList.contains("hidden")) return;

        if (e.key === "Escape") {
            closeLightboxModal();
        }

        if (e.key === "ArrowLeft") {
            showPreviousLightboxImage();
        }

        if (e.key === "ArrowRight") {
            showNextLightboxImage();
        }
    });

    lightboxInitialized = true;
}

export function openLightboxModal(imageSrc, imageAlt = "") {
    openLightboxGallery(
        [{ src: imageSrc, alt: imageAlt }],
        0
    );
}

export function openLightboxGallery(items = [], startIndex = 0) {
    initLightboxModal();

    const modal = document.getElementById("lightbox-modal");
    if (!modal) return;
    if (!items.length) return;

    lightboxItems = items;
    lightboxIndex = Math.max(0, Math.min(startIndex, items.length - 1));
    resetTouchState();

    renderLightboxImage();

    modal.classList.remove("hidden");
    modal.classList.remove("is-closing");
    modal.classList.add("is-opening");

    document.body.classList.add("lightbox-open");

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.classList.remove("is-opening");
        });
    });
}

export function closeLightboxModal() {
    const modal = document.getElementById("lightbox-modal");
    if (!modal || modal.classList.contains("hidden")) return;
    if (isLightboxClosing) return;

    isLightboxClosing = true;
    modal.classList.add("is-closing");

    setTimeout(() => {
        finishLightboxClose();
    }, 180);
}
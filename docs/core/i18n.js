// core/i18n.js

import { en } from "../locales/en.js";
import { el } from "../locales/el.js";

const translations = {
    en,
    el
};

let currentLang = localStorage.getItem("lang") || "el";

/* =========================
   GET / SET LANGUAGE
========================= */

export function getLanguage() {
    return currentLang;
}

export function setLanguage(lang) {
    if (!translations[lang]) return;

    currentLang = lang;
    localStorage.setItem("lang", lang);
}

/* =========================
   TRANSLATION FUNCTION
========================= */

export function t(key, params = {}) {
    const keys = key.split(".");
    let value = translations[currentLang];

    for (const k of keys) {
        value = value?.[k];
    }

    if (!value) {
        console.warn("Missing translation:", key);
        return key;
    }

    // simple interpolation: {name}
    return value.replace(/\{(\w+)\}/g, (_, p) => params[p] ?? "");
}

/* =========================
   LOCALE (for dates)
========================= */

export function getLocale() {
    return currentLang === "el" ? "el-GR" : "en-US";
}
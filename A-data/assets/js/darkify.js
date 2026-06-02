/**
 * Darkify.js - A simple dark mode toggle library
 * @author Emilio Romero <emrocode@gmail.com>
 * @version 1.1.10
 * @license MIT
 */
var Darkify = function() {
    "use strict";
    const e = "undefined" != typeof window,
        t = {
            autoMatchTheme: !0,
            useLocalStorage: !0,
            useSessionStorage: !1,
            useColorScheme: ["var(--card-bg)", "#000000"]
        };
    function n() {
        try {
            return window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
        } catch (e) {
            return null;
        }
    }
    function r(e) {
        if ("function" == typeof CustomEvent) return new CustomEvent("themeChanged", {
            detail: {
                theme: e
            }
        });
        var t = document.createEvent("CustomEvent");
        return t.initCustomEvent("themeChanged", !1, !1, {
            theme: e
        }), t
    }
    class s {
        constructor(s, o) {
            this.options = {}, this.theme = "light", e && ((null == o ? void 0 : o.useLocalStorage) && (o.useSessionStorage = !1), (null == o ? void 0 : o.useSessionStorage) && (o.useLocalStorage = !1), o = Object.assign(Object.assign({}, t), o), this.options = o, this.init(s), this.theme = this.getOsPreference(o), this._style = document.createElement("style"), this._meta = document.createElement("meta"), this.createAttribute(), this.syncThemeBetweenTabs())
        }
        init(e) {
            var t = n(),
                s = ({
                    matches: e
                }) => {
                    this.theme = e ? "dark" : "light", this.savePreference(), this.createAttribute()
                };
            t && ("function" == typeof t.addEventListener ? t.addEventListener("change", s) : "function" == typeof t.addListener && t.addListener(s)), document.addEventListener("DOMContentLoaded", () => {
                const t = document.querySelector(e);
                null == t || t.addEventListener("click", () => this.toggleTheme())
            })
        }
        getOsPreference(e) {
            const {
                autoMatchTheme: t,
                useLocalStorage: o,
                useSessionStorage: a
            } = e;
            return o && window.localStorage.getItem(s.storageKey) || a && window.sessionStorage.getItem(s.storageKey) || (t && n() && n().matches ? "dark" : "light")
        }
        createAttribute() {
            const e = document.getElementsByTagName("html")[0],
                {
                    useColorScheme: t
                } = this.options;
            let s = `/**! Darkify / A simple dark mode toggle library **/\n:root:is([data-theme="${this.theme}"]),[data-theme="${this.theme}"]{color-scheme:${this.theme}}`;
            e.setAttribute("data-theme", this.theme), this.updateTags(s, null != t ? t : []), this.savePreference()
            // Dispatch custom event for UI updates
            const event = r(this.theme);
            window.dispatchEvent(event);
        }
        updateTags(e, t) {
            const s = document.head || document.getElementsByTagName("head")[0];
            this._meta.setAttribute("name", "theme-color"), this._meta.setAttribute("content", "light" === this.theme ? t[0] : t[1]), this._style.setAttribute("type", "text/css"), this._style.innerHTML = e, s.appendChild(this._meta), s.appendChild(this._style)
        }
        savePreference() {
            const {
                useLocalStorage: e
            } = this.options, t = e ? window.localStorage : window.sessionStorage;
            try {
                (e ? window.sessionStorage : window.localStorage).removeItem(s.storageKey), t.setItem(s.storageKey, this.theme)
            } catch (e) {}
        }
        syncThemeBetweenTabs() {
            window.addEventListener("storage", e => {
                e.key === s.storageKey && e.newValue && (this.theme = e.newValue, this.createAttribute())
            })
        }
        toggleTheme() {
            this.theme = "light" === this.theme ? "dark" : "light", this.createAttribute()
        }
        getCurrentTheme() {
            return this.theme
        }
    }
    return s.storageKey = "theme", s
}();

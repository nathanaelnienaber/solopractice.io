/** Shared theme storage key — safe for server + client imports. */
export const THEME_STORAGE_KEY = "solopractice-theme";

/**
 * Inline boot script: apply stored/system theme before paint so CSS variables
 * match ThemeProvider (avoids light flash; keeps class + vars in sync).
 */
export const themeInitScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var dark=t==="dark"||((t==="system"||!t)&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",dark);r.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;

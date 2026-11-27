export const themeStorageKey = "p3d-theme";

export const initialThemeScript = `(() => {
  let stored;
  try { stored = localStorage.getItem(${JSON.stringify(themeStorageKey)}); } catch {}
  document.documentElement.dataset.theme = stored === "dark" || stored === "light"
    ? stored
    : "dark";
})();`;
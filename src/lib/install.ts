// PWA install support. The browser fires `beforeinstallprompt` once, early —
// we stash it so Settings can offer a real "Install" button on Android/desktop.

let deferredPrompt: any = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  // anonymous install counter (write-only events table; skipped in demo mode)
  window.addEventListener("appinstalled", () => {
    import("./supabase").then(({ supabase, isDemo }) => {
      if (isDemo) return;
      supabase
        .from("events")
        .insert({ name: "pwa_installed", meta: { ua: navigator.userAgent } })
        .then(() => {}); // fire-and-forget (the builder only runs when awaited)
    });
  });
}

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true);

export const canPromptInstall = () => !!deferredPrompt;

export const promptInstall = async (): Promise<boolean> => {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === "accepted";
};

export const isIOS = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

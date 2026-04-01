import { useEffect, useRef } from "react";
import { toast } from "sonner";

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const MIN_FETCH_GAP_MS = 30 * 1000;

type VersionManifest = {
  version?: string;
  generatedAt?: string;
};

export function useAppVersionRefresh() {
  const lastCheckRef = useRef(0);
  const isReloadingRef = useRef(false);

  useEffect(() => {
    const currentVersion = __APP_VERSION__;

    const checkVersion = async (force = false) => {
      if (isReloadingRef.current) return;

      const now = Date.now();
      if (!force && now - lastCheckRef.current < MIN_FETCH_GAP_MS) return;
      lastCheckRef.current = now;

      try {
        const response = await fetch(`/version.json?t=${now}`, {
          cache: "no-store",
          headers: {
            "cache-control": "no-cache",
            pragma: "no-cache",
          },
        });

        if (!response.ok) return;

        const manifest = (await response.json()) as VersionManifest;
        const remoteVersion = manifest.version?.trim();

        if (!remoteVersion || remoteVersion === currentVersion) return;

        isReloadingRef.current = true;
        toast.info("Atualização encontrada. Recarregando automaticamente...");

        window.setTimeout(() => {
          const targetUrl = new URL(window.location.href);
          targetUrl.searchParams.set("v", remoteVersion);
          window.location.replace(targetUrl.toString());
        }, 1200);
      } catch {
        // Falha silenciosa para não impactar a experiência do usuário.
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void checkVersion();
      }
    }, VERSION_CHECK_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkVersion(true);
      }
    };

    const handleFocus = () => {
      void checkVersion(true);
    };

    void checkVersion(true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);
}

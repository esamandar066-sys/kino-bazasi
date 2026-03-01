import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

    if (isIOSDevice && !isStandalone) {
      const dismissed = localStorage.getItem("install-dismissed");
      if (!dismissed) {
        setIsIOS(true);
        setShowPrompt(true);
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem("install-dismissed");
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("install-dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 safe-area-bottom" data-testid="install-prompt">
      <div className="max-w-md mx-auto bg-card border border-border rounded-xl p-4 shadow-2xl shadow-black/50 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Kinolar ilovasini o'rnating</p>
          <p className="text-xs text-muted-foreground">
            {isIOS
              ? "Safari menyusidan \"Bosh ekranga qo'shish\" tugmasini bosing"
              : "Tezkor kirish uchun qurilmangizga o'rnating"}
          </p>
        </div>
        {!isIOS && (
          <Button
            size="sm"
            className="bg-primary text-white flex-shrink-0"
            onClick={handleInstall}
            data-testid="button-install"
          >
            O'rnatish
          </Button>
        )}
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-1"
          data-testid="button-dismiss-install"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

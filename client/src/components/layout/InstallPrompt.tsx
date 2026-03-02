import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone } from "lucide-react";
import appLogoPath from "@assets/ChatGPT_Image_2_мар._2026_г.,_06_53_17_1772417422607.png";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return;

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    const dismissed = localStorage.getItem("install-dismissed");
    const dismissedTime = dismissed ? Number(dismissed) : 0;
    const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);

    if (isIOSDevice) {
      setIsIOS(true);
      if (hoursSinceDismissed > 24) {
        setShowPrompt(true);
      }
    } else {
      if (hoursSinceDismissed > 24) {
        setShowPrompt(true);
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (hoursSinceDismissed > 24) {
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
    localStorage.setItem("install-dismissed", String(Date.now()));
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 safe-area-bottom" data-testid="install-prompt">
      <div className="max-w-md mx-auto bg-gradient-to-r from-card to-card/95 border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-white/30 hover:text-white/70 p-1 transition-colors"
          data-testid="button-dismiss-install"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <img
            src={appLogoPath}
            alt="Kinolar"
            className="w-12 h-12 rounded-xl shadow-lg"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Kinolar Ilovasi</p>
            <p className="text-xs text-white/50">Kinolarni qulay ko'ring</p>
          </div>
        </div>

        <div className="flex gap-2">
          {isIOS ? (
            <div className="flex-1 bg-white/5 rounded-xl p-3 border border-white/5">
              <p className="text-xs text-white/60 leading-relaxed">
                Safari menyusidan <span className="text-white font-medium">⎙ "Bosh ekranga qo'shish"</span> tugmasini bosing
              </p>
            </div>
          ) : (
            <>
              {deferredPrompt && (
                <Button
                  className="flex-1 bg-primary text-white font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40"
                  onClick={handleInstall}
                  data-testid="button-install-pwa"
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  O'rnatish
                </Button>
              )}
              <Button
                variant={deferredPrompt ? "outline" : "default"}
                className={deferredPrompt
                  ? "flex-1 border-white/10 text-white rounded-xl"
                  : "flex-1 bg-primary text-white font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40"
                }
                onClick={() => {
                  window.open('/api/download-apk', '_blank');
                }}
                data-testid="button-download-apk"
              >
                <Download className="w-4 h-4 mr-2" />
                APK yuklash
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

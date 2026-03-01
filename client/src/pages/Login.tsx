import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Clapperboard, Phone, Loader2, CheckCircle2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { SiTelegram } from "react-icons/si";
import { useQueryClient } from "@tanstack/react-query";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [telegramVerified, setTelegramVerified] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      stopPolling();
      setLocation("/");
    }
  }, [isAuthenticated, setLocation, stopPolling]);

  useEffect(() => {
    if (step === "code" && phoneNumber) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/auth/phone/check-telegram?phoneNumber=${encodeURIComponent(phoneNumber)}`, {
            credentials: "include",
          });
          const data = await res.json();
          if (data.verified) {
            stopPolling();
            setTelegramVerified(true);
            toast({ title: "Telegram orqali tasdiqlandi!" });
            await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
            setTimeout(() => setLocation("/"), 1000);
          }
        } catch {}
      }, 2000);
    }

    return () => stopPolling();
  }, [step, phoneNumber, stopPolling, toast, queryClient, setLocation]);

  if (isAuthenticated) {
    return null;
  }

  const handleSendCode = async () => {
    if (!phoneNumber || phoneNumber.length < 9) {
      toast({ title: "Telefon raqamni to'liq kiriting", variant: "destructive" });
      return;
    }
    if (!telegramUsername || telegramUsername.length < 2) {
      toast({ title: "Telegram username kiriting", variant: "destructive" });
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch("/api/auth/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, telegramUsername: telegramUsername.replace(/^@/, "") }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.message || "Xatolik", variant: "destructive" });
        return;
      }
      if (data.codeSentDirectly) {
        setTelegramUrl("");
        setStep("code");
        toast({ title: "Tasdiqlash kodi Telegram botga yuborildi!" });
      } else {
        setTelegramUrl(data.telegramBotUrl || "");
        setStep("code");
        toast({ title: "Telegram botga o'ting va tasdiqlash kodini oling" });
      }
    } catch {
      toast({ title: "Xatolik yuz berdi", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      toast({ title: "6 xonali kodni kiriting", variant: "destructive" });
      return;
    }
    setIsVerifying(true);
    try {
      const res = await fetch("/api/auth/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, code }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.message || "Kod noto'g'ri", variant: "destructive" });
        return;
      }
      toast({ title: "Muvaffaqiyatli kirildi!" });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    } catch {
      toast({ title: "Xatolik yuz berdi", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Clapperboard className="w-10 h-10 text-primary" />
          <h1 className="text-3xl font-black tracking-wider uppercase text-white" data-testid="text-app-title">
            Kinolar
          </h1>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-foreground" data-testid="text-login-title">Kirish</CardTitle>
            <CardDescription>Akkauntingizga kiring yoki ro'yxatdan o'ting</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="phone" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="phone" data-testid="tab-phone">
                  <Phone className="w-4 h-4 mr-2" />
                  Telefon
                </TabsTrigger>
                <TabsTrigger value="google" data-testid="tab-google">
                  <SiGoogle className="w-4 h-4 mr-2" />
                  Google
                </TabsTrigger>
              </TabsList>

              <TabsContent value="phone" className="space-y-4">
                {step === "phone" ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Telefon raqamingiz</label>
                      <Input
                        type="tel"
                        placeholder="+998 90 123 45 67"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="bg-background"
                        data-testid="input-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Telegram username</label>
                      <div className="relative">
                        <SiTelegram className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-400" />
                        <Input
                          type="text"
                          placeholder="@username"
                          value={telegramUsername}
                          onChange={(e) => setTelegramUsername(e.target.value)}
                          className="bg-background pl-10"
                          data-testid="input-telegram-username"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tasdiqlash kodi Telegram bot orqali yuboriladi
                    </p>
                    <Button
                      onClick={handleSendCode}
                      disabled={isSending}
                      className="w-full"
                      data-testid="button-send-code"
                    >
                      {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <SiTelegram className="w-4 h-4 mr-2" />}
                      Kod yuborish
                    </Button>
                  </>
                ) : telegramVerified ? (
                  <>
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
                      <h3 className="text-xl font-bold text-green-400 mb-2" data-testid="text-verified">
                        Muvaffaqiyatli tasdiqlandi!
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Bosh sahifaga yo'naltirilmoqda...
                      </p>
                      <Loader2 className="w-6 h-6 mx-auto mt-4 animate-spin text-primary" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center mb-4">
                      {telegramUrl ? (
                        <>
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-3">
                            <SiTelegram className="w-8 h-8 mx-auto text-blue-400 mb-2" />
                            <p className="text-sm text-blue-300 font-medium mb-1">
                              Telegram botni oching
                            </p>
                            <p className="text-xs text-muted-foreground mb-3">
                              Botda "Tasdiqlash" tugmasini bosing yoki kodni qo'lda kiriting
                            </p>
                            <Button
                              variant="outline"
                              onClick={() => window.open(telegramUrl, "_blank")}
                              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              data-testid="button-open-telegram"
                            >
                              <SiTelegram className="w-4 h-4 mr-2" />
                              Telegram botni ochish
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-3">
                          <SiTelegram className="w-8 h-8 mx-auto text-blue-400 mb-2" />
                          <p className="text-sm text-blue-300 font-medium" data-testid="text-code-sent">
                            Tasdiqlash kodi Telegramga yuborildi!
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Telegramda "Tasdiqlash" tugmasini bosing
                          </p>
                          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Telegram tasdiqlash kutilmoqda...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">yoki kodni qo'lda kiriting</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Tasdiqlash kodi</label>
                      <Input
                        type="text"
                        placeholder="123456"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        maxLength={6}
                        className="bg-background text-center text-2xl tracking-[0.5em]"
                        data-testid="input-code"
                      />
                    </div>
                    <Button
                      onClick={handleVerifyCode}
                      disabled={isVerifying}
                      className="w-full"
                      data-testid="button-verify-code"
                    >
                      {isVerifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Kodni tasdiqlash
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => { setStep("phone"); setCode(""); setTelegramVerified(false); stopPolling(); }}
                      className="w-full text-muted-foreground"
                      data-testid="button-back-to-phone"
                    >
                      Orqaga qaytish
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="google" className="space-y-4">
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Google akkauntingiz orqali tezda kiring
                </p>
                <Button
                  onClick={() => { window.location.href = "/api/login"; }}
                  className="w-full"
                  variant="outline"
                  data-testid="button-google-login"
                >
                  <SiGoogle className="w-4 h-4 mr-2" />
                  Google bilan kirish
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

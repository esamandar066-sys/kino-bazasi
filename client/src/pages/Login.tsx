import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Clapperboard, Phone, Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useQueryClient } from "@tanstack/react-query";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  if (isAuthenticated) {
    return null;
  }

  const handleSendCode = async () => {
    if (!phoneNumber || phoneNumber.length < 9) {
      toast({ title: "Telefon raqamni to'liq kiriting", variant: "destructive" });
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch("/api/auth/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
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
                    <p className="text-xs text-muted-foreground">
                      Tasdiqlash kodi Telegram bot orqali yuboriladi
                    </p>
                    <Button
                      onClick={handleSendCode}
                      disabled={isSending}
                      className="w-full"
                      data-testid="button-send-code"
                    >
                      {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Phone className="w-4 h-4 mr-2" />}
                      Kod yuborish
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="text-center mb-4">
                      {telegramUrl ? (
                        <>
                          <p className="text-sm text-muted-foreground mb-3">
                            Telegram botga o'ting va tasdiqlash kodini oling:
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => window.open(telegramUrl, "_blank")}
                            className="mb-4"
                            data-testid="button-open-telegram"
                          >
                            Telegram botni ochish
                          </Button>
                        </>
                      ) : (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-3">
                          <p className="text-sm text-green-400 font-medium" data-testid="text-code-sent">
                            Tasdiqlash kodi Telegram botga yuborildi!
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Telegram ilovasini oching va kodni kiriting
                          </p>
                        </div>
                      )}
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
                      Tasdiqlash
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => { setStep("phone"); setCode(""); }}
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

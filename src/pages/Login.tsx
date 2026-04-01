import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { login } from "@/lib/auth";
import { apiUrl } from "@/lib/api";
import { httpGet } from "@/lib/http";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://gentle-path-api-883951071472.us-central1.run.app";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Support modal state
  const [showSupport, setShowSupport] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSending, setSupportSending] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log("LOGIN: submit clicked");
      console.log("API_BASE:", API_BASE);

      const auth = getAuth();
      await setPersistence(auth, browserSessionPersistence);

      const user = await login(email, password);

      console.log("LOGIN: firebase user uid:", user?.uid);

      const token = await user.getIdToken(true);
      console.log("ID_TOKEN:", token);

      console.log("LOGIN: calling /api/me ...");
      const url = apiUrl("/api/me");
      console.log("LOGIN: calling /api/me ...", url);

      const r = await httpGet(url, {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      });

      console.log("LOGIN: /api/me status:", r.status);
      console.log("LOGIN: /api/me data:", r.data);

      if (r.status < 200 || r.status >= 300) {
        throw new Error(
          `Failed to load profile: ${r.status} ${
            typeof r.data === "string" ? r.data : JSON.stringify(r.data)
          }`
        );
      }

      const me = r.data as any;

      navigate(me.role === "admin" ? "/admin" : "/dashboard");

      toast({
        title: "Welcome back",
        description: "You've successfully logged in.",
      });
    } catch (err: any) {
      const message =
        err?.name === "AbortError"
          ? "Server took too long to respond. Please try again."
          : err?.code === "auth/invalid-credential"
          ? "Invalid email or password."
          : err?.message || "Login failed.";

      console.error("LOGIN: error raw", err);
      console.error("LOGIN: error json", JSON.stringify(err, Object.getOwnPropertyNames(err)));

      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const submitSupport = async () => {
    if (!supportName || !supportEmail || !supportSubject || !supportMessage) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setSupportSending(true);

    try {
      const res = await fetch(`${API_BASE}/support/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: supportSubject,
          fromEmail: supportEmail,
          message: `Name: ${supportName}\nEmail: ${supportEmail}\n\n${supportMessage}`,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      toast({
        title: "Message sent",
        description: "Our support team will get back to you shortly.",
      });

      setSupportName("");
      setSupportEmail("");
      setSupportSubject("");
      setSupportMessage("");
      setShowSupport(false);
    } catch (err: any) {
      toast({
        title: "Failed to send message",
        description: err?.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSupportSending(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <div className="pt-16 pb-8 px-6 text-center">
        <div className="inline-flex w-16 h-16 rounded-full bg-primary/10 mb-6 items-center justify-center">
          <Leaf className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-serif text-3xl font-semibold mb-2">
          Harmonic Healing Solutions
        </h1>
        <p className="text-muted-foreground">Your guided journey to wellness</p>
      </div>

      <div className="flex-1 px-4 pb-8">
        <Card className="max-w-sm mx-auto">
          <CardHeader className="text-center pb-4">
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Sign in to continue your healing journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    className="pl-10"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    className="pl-10 pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <p className="text-center text-sm mt-6">
              Need help?{" "}
              <button
                type="button"
                onClick={() => setShowSupport(true)}
                className="text-primary hover:underline"
              >
                Contact support
              </button>
            </p>
          </CardContent>
        </Card>
      </div>

      {showSupport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowSupport(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">Contact Support</h2>

            <Input
              placeholder="Your name"
              value={supportName}
              onChange={(e) => setSupportName(e.target.value)}
              className="mb-3"
            />
            <Input
              placeholder="Your email"
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="mb-3"
            />
            <Input
              placeholder="Subject"
              value={supportSubject}
              onChange={(e) => setSupportSubject(e.target.value)}
              className="mb-3"
            />
            <textarea
              className="w-full rounded border px-3 py-2 text-sm mb-4"
              rows={4}
              placeholder="Describe your issue"
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSupport(false)}
                className="px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitSupport}
                disabled={supportSending}
                className="px-4 py-2 text-sm text-white bg-black rounded disabled:opacity-60"
              >
                {supportSending ? "Sending..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="py-6 text-center text-xs text-muted-foreground">
        Your healing journey is private and secure
      </div>
    </div>
  );
};

export default Login;
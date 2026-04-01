import { ArrowLeft, Leaf, LogOut, UserCircle, KeyRound, LifeBuoy } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getAuth, signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { fetchMe, type AppMe } from "@/lib/me";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  title?: string;
  showBack?: boolean;

  // enable on dashboard for client profile menu
  showProfileMenu?: boolean;

  // optional hook for your password reset flow
  onChangePasswordClick?: () => void;
}

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://gentle-path-api-883951071472.us-central1.run.app";

export const Header = ({
  title,
  showBack = false,
  showProfileMenu = false,
  onChangePasswordClick,
}: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const isHome = location.pathname === "/dashboard" || location.pathname === "/";
  const hideLogout = location.pathname === "/login";
  const isAdminRoute = location.pathname.startsWith("/admin");

  // Client dashboard keeps using prop-based menu.
  // Admin pages always use profile dropdown so logout stays inside it.
  const shouldShowProfileMenu = showProfileMenu || isAdminRoute;

  const [me, setMe] = useState<AppMe | null>(null);

  // Support modal state
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSending, setSupportSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!shouldShowProfileMenu) return;

    (async () => {
      try {
        const data = await fetchMe();
        if (cancelled) return;

        setMe(data);

        // Prefill support fields from profile
        setSupportName(data?.name?.trim() || "");
        setSupportEmail(data?.email || "");
      } catch (e) {
        console.error(e);
        if (!cancelled) setMe(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldShowProfileMenu]);

  const handleLogout = async () => {
    try {
      await signOut(getAuth());
      navigate("/login");
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (onChangePasswordClick) {
        onChangePasswordClick();
        return;
      }

      const user = getAuth().currentUser;

      if (!user) {
        throw new Error("Not authenticated");
      }

      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE}/api/me/password-reset-link`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to generate password reset link");
      }

      const data = await res.json();

      if (!data?.resetLink) {
        throw new Error("Reset link missing");
      }

      window.open(data.resetLink, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast({
        title: "Change password failed",
        description: err?.message || "Could not open password reset link.",
        variant: "destructive",
      });
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

      // reset message fields, keep name/email for convenience
      setSupportSubject("");
      setSupportMessage("");
      setSupportOpen(false);
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
    <>
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && !isHome ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="h-9 w-9"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Leaf className="h-4 w-4 text-primary" />
                </div>
              </div>
            )}

            {title && (
              <h1 className="font-serif text-lg font-normal text-foreground">
                {title}
              </h1>
            )}
          </div>

          {shouldShowProfileMenu && !hideLogout && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <UserCircle className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-64">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {me?.name?.trim() || (isAdminRoute ? "Admin" : "Client")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {me?.email || ""}
                  </p>
                </div>

                <DropdownMenuSeparator />

                {!isAdminRoute && (
                  <>
                    <DropdownMenuItem
                      onClick={() => navigate("/account")}
                      className="cursor-pointer"
                    >
                      <UserCircle className="h-4 w-4 mr-2" />
                      Manage account
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={handleChangePassword}
                      className="cursor-pointer"
                    >
                      <KeyRound className="h-4 w-4 mr-2" />
                      Change password
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuItem
                  onClick={() => setSupportOpen(true)}
                  className="cursor-pointer"
                >
                  <LifeBuoy className="h-4 w-4 mr-2" />
                  Support
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!hideLogout && !shouldShowProfileMenu && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-9 w-9 md:hidden"
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </header>

      {supportOpen && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setSupportOpen(false)}
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
                onClick={() => setSupportOpen(false)}
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
    </>
  );
};
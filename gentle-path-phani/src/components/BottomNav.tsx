import { Home, FileText, Pill, MessageSquare, LayoutDashboard } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

const clientNavItems: NavItem[] = [
  { icon: <Home className="h-5 w-5" />, label: "Home", path: "/dashboard" },
  { icon: <FileText className="h-5 w-5" />, label: "Sheets", path: "/sheets" },
  { icon: <Pill className="h-5 w-5" />, label: "Protocol", path: "/protocol" },
  { icon: <MessageSquare className="h-5 w-5" />, label: "Message", path: "/message" },
];

const adminNavItems: NavItem[] = [
  { icon: <LayoutDashboard className="h-5 w-5" />, label: "Dashboard", path: "/admin" },
  { icon: <Home className="h-5 w-5" />, label: "Users", path: "/admin/users" },
  { icon: <FileText className="h-5 w-5" />, label: "Content", path: "/admin/content" },
  { icon: <MessageSquare className="h-5 w-5" />, label: "Messages", path: "/admin/messages" },
];

interface BottomNavProps {
  isAdmin?: boolean;
}

export const BottomNav = ({ isAdmin = false }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const items = isAdmin ? adminNavItems : clientNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/50 safe-area-pb">
      <div className="container max-w-lg mx-auto">
        <div className="flex justify-around items-center h-16">
          {items.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/dashboard' && item.path !== '/admin' && location.pathname.startsWith(item.path));
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all duration-200",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "transition-transform duration-200",
                  isActive && "scale-110"
                )}>
                  {item.icon}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

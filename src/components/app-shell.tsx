import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Activity,
  Users,
  Package,
  LogOut,
  Wifi,
  Menu,
  X,
  Network,
  ClipboardList,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/monitoramento", label: "Monitoramento", icon: Activity },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/planos", label: "Planos", icon: Package },
  { to: "/ftth", label: "Mapa FTTH", icon: Network },
  { to: "/os", label: "Ordens de Serviço", icon: ClipboardList },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between bg-sidebar text-sidebar-foreground px-4 h-14 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Wifi className="h-5 w-5 text-sidebar-primary" />
          <span className="font-semibold">ISP Manager</span>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="p-2">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-30 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          "pt-14 md:pt-0",
        )}
      >
        <div className="hidden md:flex items-center gap-2 px-6 h-16 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight">ISP Manager</div>
            <div className="text-xs opacity-70">Provedor de Internet</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
          <div className="text-xs">
            <div className="font-medium truncate">{user?.email}</div>
            <div className="opacity-70 capitalize">
              {roles.length ? roles.join(", ") : "sem papel"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div
          className={cn(
            "p-4 md:p-8 mx-auto",
            pathname.startsWith("/ftth") ? "max-w-[1600px]" : "max-w-7xl",
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

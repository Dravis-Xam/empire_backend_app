import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Package, ShoppingCart, Truck, Users, Bell, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "stock_manager"] },
  { label: "Products", href: "/dashboard/products", icon: Package, roles: ["admin", "stock_manager"] },
  { label: "Orders", href: "/dashboard/orders", icon: ShoppingCart, roles: ["admin", "customer_care", "client"] },
  { label: "Deliveries", href: "/dashboard/deliveries", icon: Truck, roles: ["admin", "delivery_crew", "customer_care"] },
  { label: "Users", href: "/dashboard/users", icon: Users, roles: ["admin"] },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, roles: ["all"] },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const filteredNav = navItems.filter(item => 
    item.roles.includes("all") || item.roles.includes(user.role)
  );

  return (
    <div className="h-screen w-64 bg-white border-r border-border fixed left-0 top-0 flex flex-col shadow-xl shadow-black/5 z-20">
      <div className="p-6 border-b border-border/50">
        <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          NexusAdmin
        </h1>
        <p className="text-xs text-muted-foreground mt-1 capitalize font-medium">
          {user.role.replace('_', ' ')} Portal
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredNav.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer group",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                <span className="font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 p-8 min-h-screen">
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}

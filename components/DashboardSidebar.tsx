"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Leaf,
  Target,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { href: "/dashboard", label: "Discover", icon: Zap, color: "text-amber" },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/dashboard?tab=interview", label: "Interview Prep", icon: Target },
  { href: "/dashboard?tab=skills", label: "Skill Tree", icon: Leaf },
];

const analyticsItems = [
  { href: "/dashboard?tab=leaderboard", label: "Leaderboards", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-52 flex-shrink-0 flex-col border-r border-border bg-bg py-6 lg:flex">
      <div className="px-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Menu
        </p>
        <nav className="mt-2 space-y-0.5">
          {menuItems.map((item) => {
            const active = pathname === item.href.split("?")[0];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-card2 text-text"
                    : "text-muted hover:bg-card2 hover:text-text"
                )}
              >
                <item.icon
                  className={cn("h-4 w-4", item.color && active && item.color)}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-8 px-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Analytics
        </p>
        <nav className="mt-2 space-y-0.5">
          {analyticsItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-card2 hover:text-text"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}

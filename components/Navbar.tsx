"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/onboarding", label: "Profile" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green/20 border border-green/30">
            <span className="font-mono text-xs font-medium text-green">CP</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">CareerPilot</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-colors",
                pathname === link.href
                  ? "bg-card2 text-text border border-border"
                  : "text-muted hover:text-text"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/onboarding">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/onboarding">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

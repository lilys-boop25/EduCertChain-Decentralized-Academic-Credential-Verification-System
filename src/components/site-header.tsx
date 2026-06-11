import { Link, useRouterState } from "@tanstack/react-router";
import { GraduationCap, Wallet } from "lucide-react";
import { useWallet, shortAddress } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/login", label: "Sign in" },
  { to: "/admin", label: "Admin" },
  { to: "/university", label: "University" },
  { to: "/student", label: "Student" },
  { to: "/verify", label: "Verify" },
];

export function SiteHeader() {
  const { address, onSepolia, connect, connecting, switchToSepolia, hasWallet } = useWallet();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleConnect = async () => {
    try {
      await connect();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect wallet");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">CredChain</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                pathname === item.to && "bg-secondary text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {address && !onSepolia && (
            <Button variant="outline" size="sm" onClick={() => switchToSepolia().catch(() => {})}>
              Switch to Sepolia
            </Button>
          )}
          {address ? (
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 font-mono text-xs">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  onSepolia ? "bg-success" : "bg-destructive",
                )}
              />
              {shortAddress(address)}
            </Badge>
          ) : (
            <Button size="sm" onClick={handleConnect} disabled={connecting || !hasWallet}>
              <Wallet className="h-4 w-4" />
              {hasWallet ? (connecting ? "Connecting…" : "Connect Wallet") : "No wallet found"}
            </Button>
          )}
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground",
              pathname === item.to && "bg-secondary text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

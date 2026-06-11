import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet, UserCog, Landmark, GraduationCap, SearchCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { useWallet, shortAddress } from "@/hooks/use-wallet";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — CredChain" },
      { name: "description", content: "Connect your Web3 wallet and choose your role to enter CredChain." },
    ],
  }),
  component: LoginPage,
});

type Role = "admin" | "university" | "student" | "verify";

const roles: { id: Role; to: string; icon: typeof UserCog; title: string; text: string }[] = [
  { id: "admin", to: "/admin", icon: UserCog, title: "Admin", text: "Manage authorized universities on-chain." },
  { id: "university", to: "/university", icon: Landmark, title: "University", text: "Issue and revoke signed credentials." },
  { id: "student", to: "/student", icon: GraduationCap, title: "Student", text: "Hold credentials and create selective proofs." },
  { id: "verify", to: "/verify", icon: SearchCheck, title: "Verifier", text: "Verify a proof — no wallet required." },
];

function LoginPage() {
  const navigate = useNavigate();
  const { address, onSepolia, connect, connecting, switchToSepolia, hasWallet } = useWallet();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("credchain.role") as Role | null;
      if (saved) setRole(saved);
    } catch {}
  }, []);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect wallet");
    }
  };

  const pickRole = (r: Role) => {
    setRole(r);
    try { localStorage.setItem("credchain.role", r); } catch {}
  };

  const enter = () => {
    if (!role) return;
    const target = roles.find((x) => x.id === role)!;
    navigate({ to: target.to });
  };

  const needsWallet = role !== "verify";
  const ready = role === "verify" || (!!address && onSepolia);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold md:text-4xl">Sign in to CredChain</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your wallet is your identity. Pick a role to enter the right portal.
          </p>
        </div>

        {/* Step 1: wallet */}
        <section className="mt-10 rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 1</p>
              <h2 className="font-display text-lg font-semibold">Connect wallet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Required for Admin, University, and Student. Verifier can skip this.
              </p>
            </div>
            {address ? (
              <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 font-mono text-xs">
                <span className={cn("h-2 w-2 rounded-full", onSepolia ? "bg-success" : "bg-destructive")} />
                {shortAddress(address)}
              </Badge>
            ) : (
              <Button onClick={handleConnect} disabled={connecting || !hasWallet}>
                <Wallet className="h-4 w-4" />
                {hasWallet ? (connecting ? "Connecting…" : "Connect MetaMask") : "No wallet found"}
              </Button>
            )}
          </div>
          {address && !onSepolia && (
            <div className="mt-4 flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              <span>Wrong network. Switch to Sepolia to continue.</span>
              <Button size="sm" variant="outline" onClick={() => switchToSepolia().catch(() => {})}>
                Switch to Sepolia
              </Button>
            </div>
          )}
          {!hasWallet && (
            <p className="mt-3 text-xs text-muted-foreground">
              No MetaMask detected. Install the extension at{" "}
              <a className="underline" href="https://metamask.io/download" target="_blank" rel="noreferrer">metamask.io</a>.
            </p>
          )}
        </section>

        {/* Step 2: role */}
        <section className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 2</p>
          <h2 className="font-display text-lg font-semibold">Choose your role</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {roles.map((r) => {
              const selected = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => pickRole(r.id)}
                  className={cn(
                    "group rounded-lg border bg-background p-4 text-left transition-all hover:border-primary/60",
                    selected ? "border-primary ring-2 ring-primary/30" : "border-border",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <r.icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{r.title}</h3>
                        {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.text}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 3: enter */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {role
              ? needsWallet
                ? ready
                  ? "Ready to enter."
                  : "Connect your wallet on Sepolia to continue."
                : "Verifier doesn't need a wallet."
              : "Select a role to continue."}
          </p>
          <div className="flex gap-2">
            <Link to="/" className="inline-flex items-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent">
              Back
            </Link>
            <Button onClick={enter} disabled={!role || !ready}>
              Enter portal <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

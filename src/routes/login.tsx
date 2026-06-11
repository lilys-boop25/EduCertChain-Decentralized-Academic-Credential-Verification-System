import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Wallet, UserCog, Landmark, GraduationCap, SearchCheck,
  ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { useWallet, shortAddress } from "@/hooks/use-wallet";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getRegistryConfig } from "@/lib/credentials/api.functions";
import { getReadRegistry } from "@/lib/credentials/contract";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — CredChain" },
      { name: "description", content: "Choose your role and connect your Web3 wallet to enter CredChain." },
    ],
  }),
  component: LoginPage,
});

type Role = "admin" | "university" | "student" | "verify";

const roles: { id: Role; to: string; icon: typeof UserCog; title: string; text: string; needsWallet: boolean }[] = [
  { id: "admin", to: "/admin", icon: UserCog, title: "Admin", text: "Must be the wallet that deployed the registry contract.", needsWallet: true },
  { id: "university", to: "/university", icon: Landmark, title: "University", text: "Must be a wallet authorized by Admin as an issuer.", needsWallet: true },
  { id: "student", to: "/student", icon: GraduationCap, title: "Student", text: "Any wallet — credentials are bound to your address.", needsWallet: true },
  { id: "verify", to: "/verify", icon: SearchCheck, title: "Verifier", text: "No wallet required — upload a proof to verify it.", needsWallet: false },
];

function LoginPage() {
  const navigate = useNavigate();
  const { address, onSepolia, connect, connecting, switchToSepolia, hasWallet } = useWallet();
  const [role, setRole] = useState<Role | null>(null);

  const fetchConfig = useServerFn(getRegistryConfig);
  const { data: config } = useQuery({
    queryKey: ["registry-config"],
    queryFn: () => fetchConfig(),
  });
  const contractAddress = config?.contractAddress ?? null;

  // On-chain role validation
  const check = useQuery({
    queryKey: ["role-check", role, address, contractAddress],
    enabled: !!role && !!address && onSepolia && !!contractAddress && (role === "admin" || role === "university"),
    queryFn: async () => {
      const registry = getReadRegistry(contractAddress!);
      if (role === "admin") {
        const adminAddr = (await registry.admin()) as string;
        return { ok: adminAddr.toLowerCase() === address!.toLowerCase(), expected: adminAddr };
      }
      if (role === "university") {
        const authorized = (await registry.authorizedIssuers(address!)) as boolean;
        return { ok: authorized, expected: null as string | null };
      }
      return { ok: true, expected: null };
    },
  });

  const handleConnect = async () => {
    try {
      await connect();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect wallet");
    }
  };

  const selected = role ? roles.find((r) => r.id === role)! : null;

  const walletReady = !selected?.needsWallet || (!!address && onSepolia);
  const roleReady =
    role === "verify" ||
    role === "student" ||
    (role && check.data?.ok === true);

  const ready = walletReady && roleReady && !check.isFetching;

  const enter = () => {
    if (!ready || !selected) return;
    navigate({ to: selected.to });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold md:text-4xl">Sign in to CredChain</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick a role first — then connect the wallet that matches it.
          </p>
        </div>

        {/* Step 1: role */}
        <section className="mt-10 rounded-xl border border-border bg-card p-6 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 1</p>
          <h2 className="font-display text-lg font-semibold">Choose your role</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {roles.map((r) => {
              const isSel = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={cn(
                    "rounded-lg border bg-background p-4 text-left transition-all hover:border-primary/60",
                    isSel ? "border-primary ring-2 ring-primary/30" : "border-border",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <r.icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{r.title}</h3>
                        {isSel && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.text}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2: wallet + validation */}
        <section
          className={cn(
            "mt-6 rounded-xl border bg-card p-6 shadow-card transition-opacity",
            !role && "opacity-60 pointer-events-none",
            "border-border",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 2</p>
              <h2 className="font-display text-lg font-semibold">
                {selected?.needsWallet === false ? "No wallet needed" : "Connect wallet"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {!role && "Select a role above first."}
                {selected?.needsWallet === false && "Verifier is public — anyone can verify a proof."}
                {selected?.needsWallet && "Use the wallet that matches the chosen role."}
              </p>
            </div>
            {selected?.needsWallet && (
              address ? (
                <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 font-mono text-xs">
                  <span className={cn("h-2 w-2 rounded-full", onSepolia ? "bg-success" : "bg-destructive")} />
                  {shortAddress(address)}
                </Badge>
              ) : (
                <Button onClick={handleConnect} disabled={connecting || !hasWallet}>
                  <Wallet className="h-4 w-4" />
                  {hasWallet ? (connecting ? "Connecting…" : "Connect MetaMask") : "No wallet found"}
                </Button>
              )
            )}
          </div>

          {selected?.needsWallet && address && !onSepolia && (
            <div className="mt-4 flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              <span>Wrong network. Switch to Sepolia.</span>
              <Button size="sm" variant="outline" onClick={() => switchToSepolia().catch(() => {})}>
                Switch to Sepolia
              </Button>
            </div>
          )}

          {/* Role validation results */}
          {selected?.needsWallet && address && onSepolia && (
            <div className="mt-4 space-y-2">
              {!contractAddress && (role === "admin" || role === "university") && (
                <Alert tone="warn">
                  Registry contract is not configured yet. Deploy it from the Admin portal first.
                </Alert>
              )}

              {(role === "admin" || role === "university") && contractAddress && (
                check.isFetching ? (
                  <Alert tone="info"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking on-chain role…</Alert>
                ) : check.isError ? (
                  <Alert tone="warn">Could not reach the registry contract. Try again.</Alert>
                ) : check.data?.ok ? (
                  <Alert tone="ok">
                    {role === "admin"
                      ? "This wallet is the contract Admin."
                      : "This wallet is an authorized University issuer."}
                  </Alert>
                ) : (
                  <Alert tone="error">
                    {role === "admin"
                      ? <>This wallet is not the Admin. Expected: <span className="font-mono">{shortAddress(check.data?.expected)}</span>. Switch wallet in MetaMask.</>
                      : <>This wallet is not an authorized issuer. Ask the Admin to add it via <span className="font-mono">addIssuer</span>.</>}
                  </Alert>
                )
              )}

              {role === "student" && (
                <Alert tone="ok">Connected. Any wallet can hold credentials.</Alert>
              )}
            </div>
          )}
        </section>

        {/* Enter */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <Button onClick={enter} disabled={!ready}>
            Enter portal <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}

function Alert({ tone, children }: { tone: "ok" | "warn" | "error" | "info"; children: React.ReactNode }) {
  const styles = {
    ok: "border-success/40 bg-success/10 text-foreground",
    warn: "border-amber-500/40 bg-amber-500/10 text-foreground",
    error: "border-destructive/40 bg-destructive/10 text-foreground",
    info: "border-border bg-muted text-foreground",
  }[tone];
  const Icon = tone === "ok" ? CheckCircle2 : tone === "error" || tone === "warn" ? AlertCircle : Loader2;
  return (
    <div className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-sm", styles)}>
      {tone !== "info" && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <div className="flex-1">{children}</div>
    </div>
  );
}

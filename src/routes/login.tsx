import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Landmark,
  Loader2,
  SearchCheck,
  ShieldCheck,
  UserCog,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { useWallet, shortAddress } from "@/hooks/use-wallet";
import { getRegistryConfig } from "@/lib/credentials/api.functions";
import { getReadRegistry } from "@/lib/credentials/contract";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in - CredChain" },
      {
        name: "description",
        content: "Choose your role first, then connect the right wallet to enter CredChain.",
      },
    ],
  }),
  component: LoginPage,
});

type Role = "admin" | "university" | "student" | "verifier";

const roles: {
  id: Role;
  to: "/admin" | "/university" | "/student" | "/verify";
  icon: typeof UserCog;
  title: string;
  text: string;
  walletRule: string;
  needsWallet: boolean;
  needsSepolia: boolean;
  needsOnChainCheck: boolean;
}[] = [
  {
    id: "admin",
    to: "/admin",
    icon: UserCog,
    title: "Admin",
    text: "Manage the registry contract and university issuers.",
    walletRule: "Wallet must match contract.admin().",
    needsWallet: true,
    needsSepolia: true,
    needsOnChainCheck: true,
  },
  {
    id: "university",
    to: "/university",
    icon: Landmark,
    title: "University",
    text: "Issue, anchor, and revoke academic credentials.",
    walletRule: "authorizedIssuers[wallet] must be true.",
    needsWallet: true,
    needsSepolia: true,
    needsOnChainCheck: true,
  },
  {
    id: "student",
    to: "/student",
    icon: GraduationCap,
    title: "Student",
    text: "View credentials and prepare selective disclosures.",
    walletRule: "Any connected wallet is accepted.",
    needsWallet: true,
    needsSepolia: false,
    needsOnChainCheck: false,
  },
  {
    id: "verifier",
    to: "/verify",
    icon: SearchCheck,
    title: "Verifier",
    text: "Verify signatures, Merkle proofs, and registry status.",
    walletRule: "No wallet required.",
    needsWallet: false,
    needsSepolia: false,
    needsOnChainCheck: false,
  },
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
  const bootstrapAdminWallet = config?.bootstrapAdminWallet ?? null;
  const selected = role ? roles.find((r) => r.id === role)! : null;

  const check = useQuery({
    queryKey: ["role-check", role, address, contractAddress],
    enabled: !!selected?.needsOnChainCheck && !!address && onSepolia && !!contractAddress,
    queryFn: async () => {
      const registry = getReadRegistry(contractAddress!);

      if (role === "admin") {
        const adminAddr = (await registry.admin()) as string;
        return {
          ok: adminAddr.toLowerCase() === address!.toLowerCase(),
          expected: adminAddr,
        };
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

  const walletReady = !!selected && (!selected.needsWallet || !!address);
  const networkReady = !!selected && (!selected.needsSepolia || onSepolia);
  const isBootstrapAdmin =
    role === "admin" &&
    !contractAddress &&
    !!address &&
    !!bootstrapAdminWallet &&
    address.toLowerCase() === bootstrapAdminWallet.toLowerCase();
  const onChainReady =
    !!selected &&
    (!selected.needsOnChainCheck ||
      isBootstrapAdmin ||
      (!!contractAddress && check.data?.ok === true));
  const blockedByBootstrapAdmin =
    role === "admin" &&
    !contractAddress &&
    !!address &&
    onSepolia &&
    (!bootstrapAdminWallet || !isBootstrapAdmin);
  const blockedByRole =
    blockedByBootstrapAdmin ||
    (!!selected?.needsOnChainCheck &&
      !!address &&
      onSepolia &&
      !!contractAddress &&
      check.data?.ok === false);
  const ready = walletReady && networkReady && onChainReady && !check.isFetching;

  const enter = () => {
    if (!ready || !selected) return;
    navigate({ to: selected.to });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr] md:items-end">
          <div>
            <Badge variant="secondary" className="mb-4">
              Role first, wallet second
            </Badge>
            <h1 className="font-display text-3xl font-semibold md:text-4xl">
              Enter the right portal
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Choose Admin, University, Student, or Verifier first. Wallet connection only starts
              after a role is selected, and Admin or University access is checked on-chain before
              entry.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-sm shadow-card">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4 text-success" />
              Access rule
            </div>
            <p className="mt-2 text-muted-foreground">
              Wrong role shows a red warning and keeps Enter portal disabled.
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-lg border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              1
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold">Choose role</h2>
              <p className="text-sm text-muted-foreground">
                This choice decides which wallet rule will be enforced.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {roles.map((r) => {
              const isSelected = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={cn(
                    "min-h-36 rounded-lg border bg-background p-4 text-left transition-all hover:border-primary/60",
                    isSelected
                      ? "border-primary bg-accent/30 ring-2 ring-primary/25"
                      : "border-border",
                  )}
                >
                  <div className="flex h-full items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <r.icon className="h-4 w-4" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold">{r.title}</h3>
                        {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.text}</p>
                      <p className="mt-3 rounded-md bg-muted px-2 py-1.5 text-xs font-medium text-foreground">
                        {r.walletRule}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className={cn(
            "mt-5 rounded-lg border border-border bg-card p-5 shadow-card transition-opacity",
            !role && "pointer-events-none opacity-60",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                2
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">
                  {selected?.needsWallet === false ? "Wallet skipped" : "Connect wallet"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {!role && "Select a role above first."}
                  {selected?.needsWallet === false &&
                    "Verifier can enter without connecting a wallet."}
                  {selected?.needsWallet && selected.walletRule}
                </p>
              </div>
            </div>

            {selected?.needsWallet &&
              (address ? (
                <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 font-mono text-xs">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      !selected.needsSepolia || onSepolia ? "bg-success" : "bg-destructive",
                    )}
                  />
                  {shortAddress(address)}
                </Badge>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={connecting || !hasWallet}
                  className="sm:mt-1"
                >
                  <Wallet className="h-4 w-4" />
                  {hasWallet
                    ? connecting
                      ? "Connecting..."
                      : "Connect MetaMask"
                    : "No wallet found"}
                </Button>
              ))}
          </div>

          {selected?.needsWallet && !address && (
            <div className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Connect a wallet to continue.
            </div>
          )}

          {selected?.needsSepolia && address && !onSepolia && (
            <div className="mt-4 flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-destructive">
                Wrong network. Switch to Sepolia before entering this portal.
              </span>
              <Button size="sm" variant="outline" onClick={() => switchToSepolia().catch(() => {})}>
                Switch to Sepolia
              </Button>
            </div>
          )}

          {selected?.needsWallet && address && (!selected.needsSepolia || onSepolia) && (
            <div className="mt-4 space-y-2">
              {!contractAddress && selected.needsOnChainCheck && (
                <RoleAlert tone={role === "admin" && isBootstrapAdmin ? "warn" : "error"}>
                  {role === "admin" ? (
                    isBootstrapAdmin ? (
                      "Bootstrap admin matched. Enter the Admin portal to deploy or save the registry contract address."
                    ) : bootstrapAdminWallet ? (
                      <>
                        This wallet is not the bootstrap Admin. Expected{" "}
                        <span className="font-mono">{shortAddress(bootstrapAdminWallet)}</span>.
                      </>
                    ) : (
                      "Bootstrap admin wallet is not configured in Supabase."
                    )
                  ) : (
                    "Registry contract is not configured, so this role cannot be verified on-chain."
                  )}
                </RoleAlert>
              )}

              {selected.needsOnChainCheck &&
                contractAddress &&
                (check.isFetching ? (
                  <RoleAlert tone="info">Checking role on-chain...</RoleAlert>
                ) : check.isError ? (
                  <RoleAlert tone="error">
                    Could not reach the registry contract. Enter portal stays locked.
                  </RoleAlert>
                ) : check.data?.ok ? (
                  <RoleAlert tone="ok">
                    {role === "admin"
                      ? "Admin check passed: connected wallet matches contract.admin()."
                      : "University check passed: authorizedIssuers[wallet] is true."}
                  </RoleAlert>
                ) : (
                  <RoleAlert tone="error">
                    {role === "admin" ? (
                      <>
                        Wrong role: this wallet is not Admin. Expected{" "}
                        <span className="font-mono">{shortAddress(check.data?.expected)}</span>.
                      </>
                    ) : (
                      "Wrong role: authorizedIssuers[wallet] is false. Ask Admin to add this wallet."
                    )}
                  </RoleAlert>
                ))}

              {role === "student" && (
                <RoleAlert tone="ok">
                  Student check passed: any connected wallet is accepted.
                </RoleAlert>
              )}
            </div>
          )}

          {role === "verifier" && (
            <div className="mt-4">
              <RoleAlert tone="ok">Verifier check passed: no wallet is required.</RoleAlert>
            </div>
          )}
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex flex-col items-end gap-2">
            {blockedByRole && (
              <p className="max-w-sm text-right text-sm font-medium text-destructive">
                Role mismatch. Select another role or switch wallet in MetaMask.
              </p>
            )}
            {!ready && selected && !blockedByRole && (
              <p className="max-w-sm text-right text-sm text-muted-foreground">
                Complete the selected role requirement before entering.
              </p>
            )}
            <Button onClick={enter} disabled={!ready} size="lg">
              Enter portal <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function RoleAlert({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "error" | "info";
  children: ReactNode;
}) {
  const styles = {
    ok: "border-success/40 bg-success/10 text-foreground",
    warn: "border-amber-500/40 bg-amber-500/10 text-foreground",
    error: "border-destructive/40 bg-destructive/10 text-foreground",
    info: "border-border bg-muted text-foreground",
  }[tone];
  const Icon = tone === "ok" ? CheckCircle2 : tone === "info" ? Loader2 : AlertCircle;

  return (
    <div className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-sm", styles)}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", tone === "info" && "animate-spin")} />
      <div className="flex-1">{children}</div>
    </div>
  );
}

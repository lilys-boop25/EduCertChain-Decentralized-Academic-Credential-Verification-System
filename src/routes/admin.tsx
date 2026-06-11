import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Contract, isAddress } from "ethers";
import { toast } from "sonner";
import { Copy, ShieldCheck, ShieldX, FileCode2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useWallet, shortAddress } from "@/hooks/use-wallet";
import {
  getRegistryConfig,
  getRegistryConfigAuthMessage,
  setRegistryConfig,
} from "@/lib/credentials/api.functions";
import {
  CONTRACT_SOURCE,
  REGISTRY_ABI,
  SEPOLIA_EXPLORER,
  getReadRegistry,
} from "@/lib/credentials/contract";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Issuer Registry | CredChain" },
      {
        name: "description",
        content:
          "Deploy the registry contract and manage authorized university issuers on Sepolia.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { address, onSepolia, getSigner, switchToSepolia } = useWallet();
  const queryClient = useQueryClient();
  const fetchConfig = useServerFn(getRegistryConfig);
  const saveConfig = useServerFn(setRegistryConfig);

  const [addrInput, setAddrInput] = useState("");
  const [issuerInput, setIssuerInput] = useState("");
  const [issuerStatus, setIssuerStatus] = useState<{ address: string; authorized: boolean } | null>(
    null,
  );

  const { data: config } = useQuery({
    queryKey: ["registry-config"],
    queryFn: () => fetchConfig(),
  });
  const contractAddress = config?.contractAddress ?? null;

  const { data: adminAddress } = useQuery({
    queryKey: ["contract-admin", contractAddress],
    enabled: !!contractAddress,
    queryFn: async () => (await getReadRegistry(contractAddress!).admin()) as string,
  });

  const isAdmin =
    !!address && !!adminAddress && address.toLowerCase() === adminAddress.toLowerCase();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!isAddress(addrInput)) throw new Error("Invalid contract address");
      if (!address) throw new Error("Connect the admin wallet first");
      if (!onSepolia) await switchToSepolia();
      // Sanity check: must be a deployed CredentialRegistry
      await getReadRegistry(addrInput).admin();
      const signer = await getSigner();
      const signature = await signer.signMessage(getRegistryConfigAuthMessage(addrInput));
      await saveConfig({ data: { contractAddress: addrInput, adminAddress: address, signature } });
    },
    onSuccess: () => {
      toast.success("Registry contract saved");
      queryClient.invalidateQueries({ queryKey: ["registry-config"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const issuerMutation = useMutation({
    mutationFn: async (action: "add" | "remove") => {
      if (!isAddress(issuerInput)) throw new Error("Invalid issuer address");
      if (!onSepolia) await switchToSepolia();
      const signer = await getSigner();
      const contract = new Contract(contractAddress!, REGISTRY_ABI, signer);
      const tx =
        action === "add"
          ? await contract.addIssuer(issuerInput)
          : await contract.removeIssuer(issuerInput);
      toast.info("Transaction submitted, waiting for confirmation…");
      await tx.wait();
      return action;
    },
    onSuccess: (action) => {
      toast.success(
        action === "add" ? "University authorized on-chain" : "University removed from registry",
      );
      setIssuerStatus(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Transaction failed"),
  });

  const checkIssuer = async () => {
    if (!isAddress(issuerInput)) return toast.error("Invalid address");
    const authorized = (await getReadRegistry(contractAddress!).authorizedIssuers(
      issuerInput,
    )) as boolean;
    setIssuerStatus({ address: issuerInput, authorized });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <div>
          <h1 className="font-display text-3xl font-semibold">Admin Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deploy the on-chain registry and manage which universities are authorized to issue
            credentials.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <FileCode2 className="h-5 w-5" /> Registry contract
            </CardTitle>
            <CardDescription>
              {contractAddress ? (
                <span>
                  Connected to{" "}
                  <a
                    href={`${SEPOLIA_EXPLORER}/address/${contractAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-foreground underline underline-offset-2"
                  >
                    {shortAddress(contractAddress)}
                  </a>{" "}
                  on Sepolia{adminAddress ? ` · contract admin ${shortAddress(adminAddress)}` : ""}
                </span>
              ) : (
                "No contract configured yet. Deploy it, then save the address below."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!contractAddress && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  config?.bootstrapAdminWallet
                    ? "border-success/40 bg-success/5"
                    : "border-destructive/40 bg-destructive/5 text-destructive"
                }`}
              >
                {config?.bootstrapAdminWallet ? (
                  <>
                    Bootstrap admin wallet:{" "}
                    <span className="font-mono">{shortAddress(config.bootstrapAdminWallet)}</span>
                  </>
                ) : (
                  "Bootstrap admin wallet is not configured in Supabase yet."
                )}
              </div>
            )}

            <Accordion type="single" collapsible>
              <AccordionItem value="deploy">
                <AccordionTrigger>How to deploy (Remix, ~2 minutes)</AccordionTrigger>
                <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                  <ol className="list-decimal space-y-1.5 pl-5">
                    <li>
                      Open{" "}
                      <a
                        className="text-foreground underline"
                        href="https://remix.ethereum.org"
                        target="_blank"
                        rel="noreferrer"
                      >
                        remix.ethereum.org
                      </a>{" "}
                      and create <code className="font-mono">CredentialRegistry.sol</code> with the
                      source below.
                    </li>
                    <li>Compile with Solidity 0.8.20+.</li>
                    <li>
                      In Deploy &amp; Run, select <strong>Injected Provider — MetaMask</strong> with
                      your wallet on <strong>Sepolia</strong> (get test ETH from a Sepolia faucet).
                    </li>
                    <li>Deploy — your wallet becomes the contract admin.</li>
                    <li>Paste the deployed contract address below and save.</li>
                  </ol>
                  <div className="relative">
                    <pre className="max-h-80 overflow-auto rounded-lg bg-primary p-4 font-mono text-xs leading-relaxed text-primary-foreground">
                      {CONTRACT_SOURCE}
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        navigator.clipboard.writeText(CONTRACT_SOURCE);
                        toast.success("Contract source copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="0x… deployed contract address"
                value={addrInput}
                onChange={(e) => setAddrInput(e.target.value.trim())}
                className="font-mono"
              />
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={
                  saveMutation.isPending ||
                  !address ||
                  (!contractAddress && !config?.bootstrapAdminWallet)
                }
              >
                {saveMutation.isPending ? "Verifying…" : "Save address"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Authorized issuers</CardTitle>
            <CardDescription>
              Add or remove university wallet addresses. Only the contract admin wallet can send
              these transactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!contractAddress ? (
              <p className="text-sm text-muted-foreground">
                Configure the registry contract first.
              </p>
            ) : !address ? (
              <p className="text-sm text-muted-foreground">
                Connect your wallet (top right) to manage issuers.
              </p>
            ) : (
              <>
                {!isAdmin && adminAddress && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    Connected wallet is not the contract admin ({shortAddress(adminAddress)}).
                    Transactions will revert.
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="issuer">University wallet address</Label>
                  <Input
                    id="issuer"
                    placeholder="0x…"
                    value={issuerInput}
                    onChange={(e) => setIssuerInput(e.target.value.trim())}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => issuerMutation.mutate("add")}
                    disabled={issuerMutation.isPending}
                  >
                    <ShieldCheck className="h-4 w-4" /> Authorize
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => issuerMutation.mutate("remove")}
                    disabled={issuerMutation.isPending}
                  >
                    <ShieldX className="h-4 w-4" /> Remove
                  </Button>
                  <Button variant="outline" onClick={checkIssuer}>
                    Check status
                  </Button>
                </div>
                {issuerStatus && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono">{shortAddress(issuerStatus.address)}</span>
                    {issuerStatus.authorized ? (
                      <Badge className="bg-success text-success-foreground">
                        Authorized issuer
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Not authorized</Badge>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

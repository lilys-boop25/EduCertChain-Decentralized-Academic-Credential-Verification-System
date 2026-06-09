import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, SearchCheck, ShieldQuestion } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { shortAddress } from "@/hooks/use-wallet";
import { getRegistryConfig, getPresentation } from "@/lib/credentials/api.functions";
import { getReadRegistry } from "@/lib/credentials/contract";
import {
  hashCourse,
  verifyMerkleProof,
  computeCredentialUid,
  recoverIssuer,
  type Presentation,
} from "@/lib/credentials/merkle";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify a Credential | CredChain" },
      { name: "description", content: "Verify ECDSA signatures, Merkle proofs, issuer authorization and revocation status of academic credentials." },
    ],
  }),
  component: VerifyPage,
});

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
}

interface VerificationOutcome {
  checks: CheckResult[];
  presentation: Presentation;
  valid: boolean;
}

function VerifyPage() {
  const fetchConfig = useServerFn(getRegistryConfig);
  const fetchPresentation = useServerFn(getPresentation);

  const [code, setCode] = useState("");
  const [json, setJson] = useState("");
  const [outcome, setOutcome] = useState<VerificationOutcome | null>(null);

  const { data: config } = useQuery({ queryKey: ["registry-config"], queryFn: () => fetchConfig() });

  const runVerification = async (presentation: Presentation): Promise<VerificationOutcome> => {
    const checks: CheckResult[] = [];
    const meta = presentation.meta;

    // 1. Credential UID integrity
    const expectedUid = computeCredentialUid(meta);
    const uidOk = expectedUid.toLowerCase() === presentation.credentialUid.toLowerCase();
    checks.push({
      label: "Credential ID matches metadata",
      ok: uidOk,
      detail: uidOk
        ? `keccak256 of metadata + Merkle root = ${shortAddress(expectedUid)}`
        : "Metadata or Merkle root was tampered with",
    });

    // 2. ECDSA signature
    const recovered = recoverIssuer(presentation.credentialUid, presentation.signature);
    const sigOk = !!recovered && recovered.toLowerCase() === presentation.issuerAddress.toLowerCase();
    checks.push({
      label: "ECDSA signature valid (secp256k1)",
      ok: sigOk,
      detail: sigOk
        ? `Signature recovers issuer ${shortAddress(recovered)}`
        : recovered
          ? `Signature recovers ${shortAddress(recovered)}, not the claimed issuer`
          : "Signature is malformed",
    });

    // 3. Merkle proofs for each disclosed course
    const proofResults = presentation.disclosed.map((d) =>
      verifyMerkleProof(hashCourse(d.course), d.proof, meta.merkleRoot),
    );
    const proofsOk = proofResults.length > 0 && proofResults.every(Boolean);
    checks.push({
      label: `Merkle proofs valid (${presentation.disclosed.length} of ${presentation.totalCourses} courses disclosed)`,
      ok: proofsOk,
      detail: proofsOk
        ? "Every disclosed course hashes into the signed Merkle root"
        : "One or more Merkle proofs do not match the root",
    });

    // 4–6. On-chain registry checks
    if (!config?.contractAddress) {
      checks.push({
        label: "On-chain registry checks",
        ok: false,
        detail: "Registry contract not configured — cannot check issuer authorization or revocation",
      });
    } else {
      const registry = getReadRegistry(config.contractAddress);
      try {
        const [authorized, anchoredBy, revoked] = await Promise.all([
          registry.authorizedIssuers(presentation.issuerAddress) as Promise<boolean>,
          registry.anchoredBy(presentation.credentialUid) as Promise<string>,
          registry.revoked(presentation.credentialUid) as Promise<boolean>,
        ]);
        checks.push({
          label: "Issuer is an authorized university",
          ok: authorized,
          detail: authorized
            ? `${shortAddress(presentation.issuerAddress)} is in the on-chain issuer registry`
            : "Issuer is not (or no longer) authorized on-chain",
        });
        const anchoredOk =
          anchoredBy.toLowerCase() === presentation.issuerAddress.toLowerCase();
        checks.push({
          label: "Credential anchored on-chain by issuer",
          ok: anchoredOk,
          detail: anchoredOk
            ? "Anchor record matches the signing issuer"
            : anchoredBy === "0x0000000000000000000000000000000000000000"
              ? "Credential was never anchored on-chain"
              : `Anchored by a different address (${shortAddress(anchoredBy)})`,
        });
        checks.push({
          label: "Not on the revocation list",
          ok: !revoked,
          detail: revoked ? "This credential has been revoked by the issuer" : "No revocation found on-chain",
        });
      } catch {
        checks.push({
          label: "On-chain registry checks",
          ok: false,
          detail: "Failed to reach the Sepolia network — try again",
        });
      }
    }

    return { checks, presentation, valid: checks.every((c) => c.ok) };
  };

  const verifyMutation = useMutation({
    mutationFn: async (source: "code" | "json") => {
      let presentation: Presentation;
      if (source === "code") {
        const trimmed = code.trim().toUpperCase();
        if (!/^[A-Z2-9]{8}$/.test(trimmed)) throw new Error("Share codes are 8 characters");
        const res = await fetchPresentation({ data: { shareCode: trimmed } });
        if (!res.presentation) throw new Error("No presentation found for this code");
        presentation = res.presentation as unknown as Presentation;
      } else {
        try {
          presentation = JSON.parse(json) as Presentation;
        } catch {
          throw new Error("Invalid JSON");
        }
      }
      if (presentation?.version !== 1 || !presentation.meta || !Array.isArray(presentation.disclosed)) {
        throw new Error("Not a valid credential presentation");
      }
      return runVerification(presentation);
    },
    onSuccess: setOutcome,
    onError: (e) => {
      setOutcome(null);
      toast.error(e instanceof Error ? e.message : "Verification failed");
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <div>
          <h1 className="font-display text-3xl font-semibold">Verify a Credential</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Checks run locally and against the Sepolia registry — no trust in this app's database required.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <SearchCheck className="h-5 w-5" /> Presentation input
            </CardTitle>
            <CardDescription>Enter the student's share code or paste their presentation JSON.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="code">
              <TabsList>
                <TabsTrigger value="code">Share code</TabsTrigger>
                <TabsTrigger value="json">Paste JSON</TabsTrigger>
              </TabsList>
              <TabsContent value="code" className="mt-4 flex gap-2">
                <Input
                  placeholder="e.g. K7PXQ2MN"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="max-w-48 font-mono uppercase"
                />
                <Button onClick={() => verifyMutation.mutate("code")} disabled={verifyMutation.isPending}>
                  {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Verify
                </Button>
              </TabsContent>
              <TabsContent value="json" className="mt-4 space-y-3">
                <Textarea
                  placeholder='{"version":1, "credentialUid": "0x…", …}'
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  className="h-40 font-mono text-xs"
                />
                <Button onClick={() => verifyMutation.mutate("json")} disabled={verifyMutation.isPending}>
                  {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Verify
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {outcome && (
          <>
            <Card className={outcome.valid ? "border-success/50" : "border-destructive/50"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  {outcome.valid ? (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-success" /> Credential verified
                    </>
                  ) : (
                    <>
                      <XCircle className="h-6 w-6 text-destructive" /> Verification failed
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {outcome.presentation.meta.studentName} — {outcome.presentation.meta.degree} in{" "}
                  {outcome.presentation.meta.field}, {outcome.presentation.meta.institution} (
                  {outcome.presentation.meta.graduationYear})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {outcome.checks.map((c) => (
                  <div key={c.label} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    {c.ok ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <ShieldQuestion className="h-5 w-5" /> Disclosed courses
                </CardTitle>
                <CardDescription>
                  {outcome.presentation.disclosed.length} disclosed ·{" "}
                  {outcome.presentation.totalCourses - outcome.presentation.disclosed.length} kept private by the
                  student
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {outcome.presentation.disclosed.map((d, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">
                        {d.course.code} — {d.course.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{d.course.credits} credits</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      Grade {d.course.grade}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

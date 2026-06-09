import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { isAddress } from "ethers";
import { toast } from "sonner";
import { Copy, EyeOff, Eye, Share2, GraduationCap } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet, shortAddress } from "@/hooks/use-wallet";
import { listStudentCredentials, createPresentation } from "@/lib/credentials/api.functions";
import {
  hashCourse,
  merkleProof,
  type Course,
  type Presentation,
} from "@/lib/credentials/merkle";

export const Route = createFileRoute("/student")({
  head: () => ({
    meta: [
      { title: "Student Wallet — Selective Disclosure | CredChain" },
      { name: "description", content: "Hold your academic credentials and generate Merkle proofs for only the courses you choose to reveal." },
    ],
  }),
  component: StudentPage,
});

function StudentPage() {
  const { address } = useWallet();
  const fetchCredentials = useServerFn(listStudentCredentials);
  const savePresentation = useServerFn(createPresentation);

  const [manualAddress, setManualAddress] = useState("");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<Set<number>>(new Set());
  const [presentationJson, setPresentationJson] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);

  const lookupAddress = address ?? (isAddress(manualAddress) ? manualAddress : null);

  const { data: credentials, isLoading } = useQuery({
    queryKey: ["student-credentials", lookupAddress],
    enabled: !!lookupAddress,
    queryFn: async () => (await fetchCredentials({ data: { address: lookupAddress! } })).credentials,
  });

  const selected = useMemo(
    () => credentials?.find((c) => c.credential_uid === selectedUid) ?? null,
    [credentials, selectedUid],
  );
  const selectedCourseList = (selected?.courses as unknown as Course[]) ?? [];

  const toggleCourse = (i: number) => {
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
    setPresentationJson(null);
    setShareCode(null);
  };

  const generateProof = () => {
    if (!selected || selectedCourses.size === 0) {
      toast.error("Select at least one course to disclose");
      return;
    }
    const allCourses = selectedCourseList;
    const leaves = allCourses.map(hashCourse);
    const disclosed = [...selectedCourses].sort((a, b) => a - b).map((i) => ({
      course: allCourses[i],
      proof: merkleProof(leaves, i),
    }));
    const presentation: Presentation = {
      version: 1,
      credentialUid: selected.credential_uid,
      issuerAddress: selected.issuer_address,
      signature: selected.signature,
      meta: {
        studentAddress: selected.student_address,
        studentName: selected.student_name,
        institution: selected.institution,
        degree: selected.degree,
        field: selected.field,
        graduationYear: selected.graduation_year,
        merkleRoot: selected.merkle_root,
      },
      totalCourses: allCourses.length,
      disclosed,
    };
    setPresentationJson(JSON.stringify(presentation, null, 2));
    setShareCode(null);
    toast.success(`Proof generated — disclosing ${disclosed.length} of ${allCourses.length} courses`);
  };

  const shareMutation = useMutation({
    mutationFn: async () => {
      const payload = JSON.parse(presentationJson!) as Presentation;
      return (await savePresentation({ data: { payload } })).shareCode;
    },
    onSuccess: (code) => {
      setShareCode(code);
      toast.success("Share code created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create share code"),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <div>
          <h1 className="font-display text-3xl font-semibold">Student Wallet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Disclose only what's requested — every hidden course stays cryptographically private.
          </p>
        </div>

        {!address && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Find your credentials</CardTitle>
              <CardDescription>Connect your wallet (top right) or enter your wallet address.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="0x… your wallet address"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value.trim())}
                  className="font-mono"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <GraduationCap className="h-5 w-5" /> Your credentials
            </CardTitle>
            <CardDescription>
              {lookupAddress ? (
                <span className="font-mono text-xs">{shortAddress(lookupAddress)}</span>
              ) : (
                "No wallet connected"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!lookupAddress ? (
              <p className="text-sm text-muted-foreground">Connect a wallet or enter an address above.</p>
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !credentials?.length ? (
              <p className="text-sm text-muted-foreground">No credentials found for this address.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {credentials.map((c) => (
                  <button
                    key={c.credential_uid}
                    onClick={() => {
                      setSelectedUid(c.credential_uid);
                      setSelectedCourses(new Set());
                      setPresentationJson(null);
                      setShareCode(null);
                    }}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      selectedUid === c.credential_uid
                        ? "border-ring bg-accent shadow-card"
                        : "border-border bg-card hover:border-ring/50"
                    }`}
                  >
                    <p className="font-display font-semibold">{c.degree} in {c.field}</p>
                    <p className="text-sm text-muted-foreground">{c.institution} · {c.graduation_year}</p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      {(c.courses as unknown as Course[]).length} courses · root {shortAddress(c.merkle_root)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Selective disclosure</CardTitle>
              <CardDescription>
                Tick the courses to reveal. Unticked courses remain hidden — the verifier only sees
                their existence as part of the Merkle root.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {selectedCourseList.map((course, i) => {
                  const checked = selectedCourses.has(i);
                  return (
                    <label
                      key={i}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        checked ? "border-ring bg-accent" : "border-border"
                      }`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleCourse(i)} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {course.code} — {course.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Grade {course.grade} · {course.credits} credits
                        </p>
                      </div>
                      {checked ? (
                        <Eye className="h-4 w-4 text-success" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={generateProof}>Generate Merkle proofs</Button>
                {presentationJson && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(presentationJson);
                        toast.success("Presentation copied to clipboard");
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copy JSON
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => shareMutation.mutate()}
                      disabled={shareMutation.isPending || !!shareCode}
                    >
                      <Share2 className="h-4 w-4" /> {shareCode ? "Code created" : "Create share code"}
                    </Button>
                  </>
                )}
              </div>

              {shareCode && (
                <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/5 p-4">
                  <span className="text-sm">Give this code to the verifier:</span>
                  <Badge className="bg-gradient-gold px-3 py-1 font-mono text-base text-gold-foreground">
                    {shareCode}
                  </Badge>
                </div>
              )}

              {presentationJson && (
                <div className="space-y-1.5">
                  <Label>Verifiable presentation</Label>
                  <Textarea readOnly value={presentationJson} className="h-56 font-mono text-xs" />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Contract, isAddress } from "ethers";
import { toast } from "sonner";
import { Plus, Trash2, PenLine, Ban, ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet, shortAddress } from "@/hooks/use-wallet";
import {
  getRegistryConfig,
  issueCredential,
  listIssuerCredentials,
} from "@/lib/credentials/api.functions";
import { REGISTRY_ABI, SEPOLIA_EXPLORER, getReadRegistry } from "@/lib/credentials/contract";
import {
  newSalt,
  hashCourse,
  merkleRoot,
  computeCredentialUid,
  type Course,
} from "@/lib/credentials/merkle";

export const Route = createFileRoute("/university")({
  head: () => ({
    meta: [
      { title: "University Portal — Issue Credentials | CredChain" },
      { name: "description", content: "Build transcripts, sign diplomas with ECDSA, and anchor credentials on-chain." },
    ],
  }),
  component: UniversityPage,
});

interface CourseRow {
  code: string;
  title: string;
  grade: string;
  credits: string;
}

const emptyCourse: CourseRow = { code: "", title: "", grade: "", credits: "" };

function UniversityPage() {
  const { address, onSepolia, getSigner, switchToSepolia } = useWallet();
  const queryClient = useQueryClient();
  const fetchConfig = useServerFn(getRegistryConfig);
  const saveCredential = useServerFn(issueCredential);
  const fetchIssued = useServerFn(listIssuerCredentials);

  const [studentName, setStudentName] = useState("");
  const [studentAddress, setStudentAddress] = useState("");
  const [institution, setInstitution] = useState("");
  const [degree, setDegree] = useState("");
  const [field, setField] = useState("");
  const [gradYear, setGradYear] = useState(String(new Date().getFullYear()));
  const [courses, setCourses] = useState<CourseRow[]>([{ ...emptyCourse }]);

  const { data: config } = useQuery({ queryKey: ["registry-config"], queryFn: () => fetchConfig() });
  const contractAddress = config?.contractAddress ?? null;

  const { data: isAuthorized } = useQuery({
    queryKey: ["issuer-authorized", contractAddress, address],
    enabled: !!contractAddress && !!address,
    queryFn: async () =>
      (await getReadRegistry(contractAddress!).authorizedIssuers(address!)) as boolean,
  });

  const { data: issued } = useQuery({
    queryKey: ["issuer-credentials", address],
    enabled: !!address,
    queryFn: async () => (await fetchIssued({ data: { address: address! } })).credentials,
  });

  const issuedUids = (issued ?? []).map((c) => c.credential_uid).join(",");
  const { data: revokedMap } = useQuery({
    queryKey: ["revoked-status", contractAddress, issuedUids],
    enabled: !!contractAddress && !!issued?.length,
    queryFn: async () => {
      const registry = getReadRegistry(contractAddress!);
      const entries = await Promise.all(
        (issued ?? []).map(async (c) => [c.credential_uid, (await registry.revoked(c.credential_uid)) as boolean] as const),
      );
      return Object.fromEntries(entries) as Record<string, boolean>;
    },
  });

  const updateCourse = (i: number, key: keyof CourseRow, value: string) =>
    setCourses((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Connect your university wallet first");
      if (!contractAddress) throw new Error("Registry contract is not configured (see Admin portal)");
      if (!isAddress(studentAddress)) throw new Error("Invalid student wallet address");
      if (!studentName || !institution || !degree || !field) throw new Error("Fill in all credential fields");
      const validRows = courses.filter((c) => c.code && c.title && c.grade);
      if (validRows.length === 0) throw new Error("Add at least one course");
      if (!onSepolia) await switchToSepolia();

      // 1. Salt every course and build the Merkle tree (each course = one leaf)
      const saltedCourses: Course[] = validRows.map((c) => ({
        code: c.code,
        title: c.title,
        grade: c.grade,
        credits: Number(c.credits) || 0,
        salt: newSalt(),
      }));
      const leaves = saltedCourses.map(hashCourse);
      const root = merkleRoot(leaves);

      // 2. Compute the credential UID and sign it with the university's ECDSA key
      const meta = {
        studentAddress,
        studentName,
        institution,
        degree,
        field,
        graduationYear: Number(gradYear),
        merkleRoot: root,
      };
      const uid = computeCredentialUid(meta);
      const signer = await getSigner();
      toast.info("Sign the credential hash in your wallet…");
      const signature = await signer.signMessage(uid);

      // 3. Anchor the credential on-chain (reverts if wallet is not an authorized issuer)
      const contract = new Contract(contractAddress, REGISTRY_ABI, signer);
      toast.info("Anchoring credential on Sepolia…");
      const tx = await contract.anchorCredential(uid);
      const receipt = await tx.wait();

      // 4. Persist the full credential (incl. salted transcript) for the student
      await saveCredential({
        data: {
          credentialUid: uid,
          studentAddress,
          studentName,
          issuerAddress: address,
          institution,
          degree,
          field,
          graduationYear: Number(gradYear),
          merkleRoot: root,
          signature,
          courses: saltedCourses,
          anchorTx: receipt?.hash ?? tx.hash,
        },
      });
    },
    onSuccess: () => {
      toast.success("Credential issued, signed, and anchored on-chain");
      setStudentName("");
      setStudentAddress("");
      setDegree("");
      setField("");
      setCourses([{ ...emptyCourse }]);
      queryClient.invalidateQueries({ queryKey: ["issuer-credentials"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Issuance failed"),
  });

  const revokeMutation = useMutation({
    mutationFn: async (uid: string) => {
      if (!contractAddress) throw new Error("Registry not configured");
      if (!onSepolia) await switchToSepolia();
      const signer = await getSigner();
      const contract = new Contract(contractAddress, REGISTRY_ABI, signer);
      const tx = await contract.revokeCredential(uid);
      toast.info("Revocation submitted…");
      await tx.wait();
    },
    onSuccess: () => {
      toast.success("Credential revoked on-chain");
      queryClient.invalidateQueries({ queryKey: ["revoked-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Revocation failed"),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <div>
          <h1 className="font-display text-3xl font-semibold">University Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Issue ECDSA-signed credentials with Merkle-tree transcripts, anchored on Sepolia.
          </p>
        </div>

        {address && contractAddress && isAuthorized === false && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Wallet {shortAddress(address)} is <strong>not an authorized issuer</strong>. Ask the admin to
            authorize it in the registry before issuing.
          </div>
        )}
        {address && isAuthorized && (
          <div className="rounded-lg border border-success/40 bg-success/5 p-4 text-sm">
            <Badge className="bg-success text-success-foreground">Authorized issuer</Badge>{" "}
            <span className="ml-2 font-mono text-xs">{shortAddress(address)}</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <PenLine className="h-5 w-5" /> Issue a credential
            </CardTitle>
            <CardDescription>
              Each course becomes a salted Merkle leaf — the student can later disclose any subset with proofs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Student name</Label>
                <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Ada Lovelace" />
              </div>
              <div className="space-y-1.5">
                <Label>Student wallet</Label>
                <Input value={studentAddress} onChange={(e) => setStudentAddress(e.target.value.trim())} placeholder="0x…" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Institution</Label>
                <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="University of Example" />
              </div>
              <div className="space-y-1.5">
                <Label>Degree</Label>
                <Input value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="BSc (Hons)" />
              </div>
              <div className="space-y-1.5">
                <Label>Field of study</Label>
                <Input value={field} onChange={(e) => setField(e.target.value)} placeholder="Computer Science" />
              </div>
              <div className="space-y-1.5">
                <Label>Graduation year</Label>
                <Input type="number" value={gradYear} onChange={(e) => setGradYear(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Transcript (Merkle leaves)</Label>
              <div className="space-y-2">
                {courses.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_2fr_0.8fr_0.8fr_auto] items-center gap-2">
                    <Input placeholder="CS101" value={c.code} onChange={(e) => updateCourse(i, "code", e.target.value)} />
                    <Input placeholder="Course title" value={c.title} onChange={(e) => updateCourse(i, "title", e.target.value)} />
                    <Input placeholder="Grade" value={c.grade} onChange={(e) => updateCourse(i, "grade", e.target.value)} />
                    <Input placeholder="ECTS" type="number" value={c.credits} onChange={(e) => updateCourse(i, "credits", e.target.value)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCourses((rows) => rows.filter((_, idx) => idx !== i))}
                      disabled={courses.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCourses((rows) => [...rows, { ...emptyCourse }])}>
                <Plus className="h-4 w-4" /> Add course
              </Button>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => issueMutation.mutate()}
              disabled={issueMutation.isPending || !address}
            >
              {issueMutation.isPending ? "Signing & anchoring…" : address ? "Sign, anchor & issue credential" : "Connect wallet to issue"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Issued credentials</CardTitle>
            <CardDescription>Credentials issued by your connected wallet, with on-chain revocation.</CardDescription>
          </CardHeader>
          <CardContent>
            {!address ? (
              <p className="text-sm text-muted-foreground">Connect your wallet to view issued credentials.</p>
            ) : !issued?.length ? (
              <p className="text-sm text-muted-foreground">No credentials issued yet.</p>
            ) : (
              <div className="space-y-3">
                {issued.map((c) => {
                  const revoked = revokedMap?.[c.credential_uid];
                  return (
                    <div key={c.credential_uid} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                      <div>
                        <p className="font-medium">
                          {c.student_name} — {c.degree} in {c.field} ({c.graduation_year})
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {shortAddress(c.credential_uid)}
                          {c.anchor_tx && (
                            <a
                              href={`${SEPOLIA_EXPLORER}/tx/${c.anchor_tx}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 inline-flex items-center gap-1 text-foreground underline underline-offset-2"
                            >
                              anchor tx <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {revoked ? (
                          <Badge variant="destructive">Revoked</Badge>
                        ) : (
                          <>
                            <Badge className="bg-success text-success-foreground">Valid</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => revokeMutation.mutate(c.credential_uid)}
                              disabled={revokeMutation.isPending}
                            >
                              <Ban className="h-3.5 w-3.5" /> Revoke
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, GitBranch, KeyRound, Landmark, GraduationCap, SearchCheck, UserCog, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CredChain — Verifiable Academic Credentials" },
      {
        name: "description",
        content:
          "Issue and verify digital diplomas with ECDSA signatures, Merkle-tree selective disclosure, and an on-chain issuer and revocation registry.",
      },
      { property: "og:title", content: "CredChain — Verifiable Academic Credentials" },
      {
        property: "og:description",
        content:
          "Prove you graduated in a specific field without revealing your entire transcript.",
      },
    ],
  }),
  component: Index,
});

const pillars = [
  {
    icon: KeyRound,
    title: "Elliptic Curve Signatures",
    text: "Universities sign each credential with their secp256k1 wallet key (EIP-191). Anyone can recover and verify the signer — no shared secrets.",
  },
  {
    icon: GitBranch,
    title: "Merkle Selective Disclosure",
    text: "Every course is a salted leaf in a Merkle tree. Students reveal only requested courses with Merkle proofs; the rest of the transcript stays private.",
  },
  {
    icon: ShieldCheck,
    title: "On-Chain Registry",
    text: "A Sepolia smart contract maintains the list of authorized universities and a revocation list. Verification checks the chain, not a database.",
  },
];

const roles = [
  {
    icon: UserCog,
    to: "/admin",
    title: "Admin",
    text: "Deploy the registry contract and authorize university wallet addresses.",
  },
  {
    icon: Landmark,
    to: "/university",
    title: "University",
    text: "Build transcripts, sign diplomas with your wallet, anchor and revoke on-chain.",
  },
  {
    icon: GraduationCap,
    to: "/student",
    title: "Student",
    text: "Hold your credentials and disclose only the courses an employer asks for.",
  },
  {
    icon: SearchCheck,
    to: "/verify",
    title: "Verifier",
    text: "Check signatures, Merkle proofs, issuer authorization, and revocation status.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="bg-gradient-hero text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="mb-4 inline-block rounded-full border border-primary-foreground/25 px-3 py-1 text-xs font-medium tracking-wide uppercase opacity-90">
            ECC · Merkle Trees · Ethereum Sepolia
          </p>
          <h1 className="font-display max-w-3xl text-4xl leading-tight font-semibold md:text-6xl">
            Digital diplomas with cryptographic selective disclosure
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed opacity-80 md:text-lg">
            A decentralized academic credential system. Universities issue ECDSA-signed
            credentials, students prove exactly what's asked — a degree, a field, a single
            course grade — and verifiers check everything against an on-chain registry.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/university"
              className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-5 py-2.5 text-sm font-semibold text-gold-foreground shadow-elegant transition-transform hover:scale-[1.02]"
            >
              Issue a credential <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/verify"
              className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/30 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-primary-foreground/10"
            >
              Verify a proof
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">How trust is established</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.title} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="font-display text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-2xl font-semibold md:text-3xl">Choose your role</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((r) => (
              <Link
                key={r.to}
                to={r.to}
                className="group rounded-xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant"
              >
                <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <r.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-lg font-semibold">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                  Open portal{" "}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-8 text-sm text-muted-foreground">
          <p>CredChain — decentralized academic credentials</p>
          <p className="font-mono text-xs">Sepolia testnet</p>
        </div>
      </footer>
    </div>
  );
}

// Merkle tree + ECDSA helpers for selective-disclosure academic credentials.
// Leaves are keccak256 hashes of salted course records; pair hashing is
// order-independent (sorted) so proofs don't need left/right flags.
import { keccak256, toUtf8Bytes, concat, hexlify, randomBytes, verifyMessage } from "ethers";

export interface Course {
  code: string;
  title: string;
  grade: string;
  credits: number;
  /** Per-leaf random salt — prevents brute-forcing hidden courses/grades. */
  salt: string;
}

export interface CredentialMeta {
  studentAddress: string;
  studentName: string;
  institution: string;
  degree: string;
  field: string;
  graduationYear: number;
  merkleRoot: string;
}

export interface DisclosedCourse {
  course: Course;
  proof: string[];
}

export interface Presentation {
  version: 1;
  credentialUid: string;
  issuerAddress: string;
  signature: string;
  meta: CredentialMeta;
  totalCourses: number;
  disclosed: DisclosedCourse[];
}

export const newSalt = (): string => hexlify(randomBytes(16));

export const hashCourse = (c: Course): string =>
  keccak256(toUtf8Bytes([c.salt, c.code, c.title, c.grade, String(c.credits)].join("|")));

const hashPair = (a: string, b: string): string =>
  a.toLowerCase() <= b.toLowerCase() ? keccak256(concat([a, b])) : keccak256(concat([b, a]));

/** Builds all tree levels, leaves first. Odd nodes are carried up unchanged. */
export function buildLevels(leaves: string[]): string[][] {
  if (leaves.length === 0) return [[]];
  const levels: string[][] = [leaves];
  let current = leaves;
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(i + 1 < current.length ? hashPair(current[i], current[i + 1]) : current[i]);
    }
    levels.push(next);
    current = next;
  }
  return levels;
}

export function merkleRoot(leaves: string[]): string {
  const levels = buildLevels(leaves);
  return levels[levels.length - 1][0] ?? "0x";
}

export function merkleProof(leaves: string[], index: number): string[] {
  const levels = buildLevels(leaves);
  const proof: string[] = [];
  let idx = index;
  for (let l = 0; l < levels.length - 1; l++) {
    const level = levels[l];
    const sibling = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (sibling >= 0 && sibling < level.length) proof.push(level[sibling]);
    idx = Math.floor(idx / 2);
  }
  return proof;
}

export function verifyMerkleProof(leaf: string, proof: string[], root: string): boolean {
  let h = leaf;
  for (const p of proof) h = hashPair(h, p);
  return h.toLowerCase() === root.toLowerCase();
}

/** Deterministic credential identifier — also used as the on-chain bytes32 id. */
export const computeCredentialUid = (meta: CredentialMeta): string =>
  keccak256(
    toUtf8Bytes(
      [
        meta.studentAddress.toLowerCase(),
        meta.studentName,
        meta.institution,
        meta.degree,
        meta.field,
        String(meta.graduationYear),
        meta.merkleRoot.toLowerCase(),
      ].join("|"),
    ),
  );

/** Recovers the ECDSA (secp256k1) signer address from an EIP-191 signature over the credential UID. */
export function recoverIssuer(credentialUid: string, signature: string): string | null {
  try {
    return verifyMessage(credentialUid, signature);
  } catch {
    return null;
  }
}

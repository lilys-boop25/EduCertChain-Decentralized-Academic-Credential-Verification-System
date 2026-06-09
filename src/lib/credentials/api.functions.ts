// Server functions for credential persistence. The database is the off-chain
// store (full transcripts, signatures, share codes); trust decisions are made
// against ECDSA signatures + the on-chain registry, never against this DB alone.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ethAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");
const hex32 = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid 32-byte hex value");
const hexStr = z.string().regex(/^0x[a-fA-F0-9]+$/).max(300);

const courseSchema = z.object({
  code: z.string().min(1).max(24),
  title: z.string().min(1).max(120),
  grade: z.string().min(1).max(12),
  credits: z.number().min(0).max(60),
  salt: hexStr.max(40),
});

export const getRegistryConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("registry_config")
    .select("contract_address, chain_id")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { contractAddress: data?.contract_address ?? null, chainId: data?.chain_id ?? 11155111 };
});

export const setRegistryConfig = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ contractAddress: ethAddress }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("registry_config")
      .update({ contract_address: data.contractAddress, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const issueSchema = z.object({
  credentialUid: hex32,
  studentAddress: ethAddress,
  studentName: z.string().min(1).max(120),
  issuerAddress: ethAddress,
  institution: z.string().min(1).max(160),
  degree: z.string().min(1).max(120),
  field: z.string().min(1).max(120),
  graduationYear: z.number().int().min(1900).max(2100),
  merkleRoot: hex32,
  signature: hexStr,
  courses: z.array(courseSchema).min(1).max(100),
  anchorTx: z.string().max(80).optional(),
});

export const issueCredential = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => issueSchema.parse(input))
  .handler(async ({ data }) => {
    // Server-side ECDSA check: the signature over the credential UID must
    // recover to the claimed issuer address.
    const { recoverIssuer } = await import("@/lib/credentials/merkle");
    const recovered = recoverIssuer(data.credentialUid, data.signature);
    if (!recovered || recovered.toLowerCase() !== data.issuerAddress.toLowerCase()) {
      throw new Error("Signature does not match the issuer address");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("credentials").insert({
      credential_uid: data.credentialUid.toLowerCase(),
      student_address: data.studentAddress.toLowerCase(),
      student_name: data.studentName,
      issuer_address: data.issuerAddress.toLowerCase(),
      institution: data.institution,
      degree: data.degree,
      field: data.field,
      graduation_year: data.graduationYear,
      merkle_root: data.merkleRoot.toLowerCase(),
      signature: data.signature,
      courses: data.courses,
      anchor_tx: data.anchorTx ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const listSchema = z.object({ address: ethAddress });

const CRED_COLUMNS =
  "credential_uid, student_address, student_name, issuer_address, institution, degree, field, graduation_year, merkle_root, signature, courses, anchor_tx, issued_at";

export const listStudentCredentials = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("credentials")
      .select(CRED_COLUMNS)
      .eq("student_address", data.address.toLowerCase())
      .order("issued_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { credentials: rows ?? [] };
  });

export const listIssuerCredentials = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("credentials")
      .select(CRED_COLUMNS)
      .eq("issuer_address", data.address.toLowerCase())
      .order("issued_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { credentials: rows ?? [] };
  });

const presentationPayload = z.object({
  version: z.literal(1),
  credentialUid: hex32,
  issuerAddress: ethAddress,
  signature: hexStr,
  meta: z.object({
    studentAddress: ethAddress,
    studentName: z.string().min(1).max(120),
    institution: z.string().min(1).max(160),
    degree: z.string().min(1).max(120),
    field: z.string().min(1).max(120),
    graduationYear: z.number().int().min(1900).max(2100),
    merkleRoot: hex32,
  }),
  totalCourses: z.number().int().min(1).max(100),
  disclosed: z
    .array(z.object({ course: courseSchema, proof: z.array(hex32).max(20) }))
    .min(1)
    .max(100),
});

export const createPresentation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ payload: presentationPayload }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const shareCode = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    const { error } = await supabaseAdmin.from("presentations").insert({
      share_code: shareCode,
      credential_uid: data.payload.credentialUid.toLowerCase(),
      payload: data.payload,
    });
    if (error) throw new Error(error.message);
    return { shareCode };
  });

export const getPresentation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ shareCode: z.string().regex(/^[A-Z2-9]{8}$/i) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("presentations")
      .select("payload, created_at")
      .eq("share_code", data.shareCode.toUpperCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { presentation: row?.payload ?? null };
  });

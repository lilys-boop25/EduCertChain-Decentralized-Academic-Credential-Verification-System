# CredChain - Verifiable Academic Credentials

CredChain is a demo application for issuing and verifying academic credentials with Ethereum wallets. It combines ECDSA signatures, Merkle trees, and a Sepolia smart contract so students can prove selected academic information without exposing their full transcript.

## Main Features

- **Admin**: deploy the registry contract, save the contract address, and authorize university wallet addresses.
- **University**: create credentials, sign them with an issuer wallet, anchor credentials on Sepolia, and revoke them when needed.
- **Student**: view credentials by wallet, choose which courses to disclose, and generate Merkle proofs or share codes.
- **Verifier**: enter a share code or JSON payload to verify signatures, Merkle proofs, issuer authorization, on-chain anchoring, and revocation status.
- **Role-based login**: choose a role first, then connect a wallet. Admin and University access is checked on-chain before entering the portal.

## Tech Stack

- React 19, TanStack Router, TanStack Start
- Vite, TypeScript, Tailwind CSS
- ethers.js
- Supabase PostgreSQL
- Ethereum Sepolia testnet
- MetaMask

## Requirements

Install or prepare:

- Node.js 22 or newer
- npm
- MetaMask in your browser
- A Supabase project
- Sepolia test ETH for the Admin and University wallets

The repository includes `bun.lock`, but the commands below use `npm` so the app is easy to run on most machines.

## Installation

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```env
SUPABASE_PROJECT_ID=your_supabase_project_id
SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

VITE_SUPABASE_PROJECT_ID=your_supabase_project_id
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_or_publishable_key
```

If the `.env` file was generated for you, it may already contain:

```env
SUPABASE_PROJECT_ID=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
```

You still need to add:

```env
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Important: `SUPABASE_SERVICE_ROLE_KEY` is a server-side secret. Do not expose it in client code, do not prefix it with `VITE_`, and do not commit your `.env` file.

## Supabase Setup

Run the migration in:

```text
supabase/migrations/20260609185644_9d15d825-60d8-4fe7-8035-f9b7fe9d0ffd.sql
```

You can run it from the Supabase SQL Editor or with the Supabase CLI. The migration creates three tables:

- `registry_config`: stores the registry contract address and chain id.
- `credentials`: stores credentials, signatures, salted transcript data, Merkle roots, and anchor transactions.
- `presentations`: stores verifier share codes and presentation JSON payloads.

The tables have RLS enabled. For this demo, server functions use the service role key to read and write application data.

After running the migration, configure the initial bootstrap Admin wallet in Supabase:

```sql
UPDATE public.registry_config
SET bootstrap_admin_wallet = '0xYourBootstrapAdminWallet'
WHERE id = 1;
```

This wallet is only used before a registry contract is saved. After `contract_address` is configured, Admin access is checked against `contract.admin()` on-chain.

## Running the App

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## MetaMask and Sepolia Setup

1. Install MetaMask.
2. Create or import demo wallets:
   - 1 Admin wallet
   - 1 University wallet
   - 1 Student wallet
3. Switch MetaMask to the Sepolia network.
4. Add Sepolia ETH from a faucet to the Admin and University wallets so they can deploy contracts and send transactions.

## Demo Scenario

### 1. Admin deploys the registry contract

1. Go to `/login`.
2. Choose the **Admin** role.
3. Connect the bootstrap Admin wallet configured in Supabase.
4. If no registry contract is configured yet, enter the Admin portal and follow the Remix deployment instructions.
5. Deploy the `CredentialRegistry` contract on Sepolia. The deploying wallet becomes `contract.admin()`.
6. Copy the deployed contract address, paste it into the Admin portal, and click **Save address**.
7. MetaMask asks the Admin wallet to sign a registry configuration message.
8. Enter the University wallet address and click **Authorize** to call `addIssuer`.

Expected result: the University wallet has `authorizedIssuers[wallet] = true`.

### 2. University issues a credential

1. Go to `/login`.
2. Choose the **University** role.
3. Connect the University wallet authorized by the Admin.
4. The app checks `authorizedIssuers[wallet]` on-chain.
5. If the check passes, click **Enter portal**.
6. Fill in the student name, Student wallet address, institution, degree, field, graduation year, and course list.
7. Click **Sign, anchor & issue credential**.
8. MetaMask asks the University wallet to sign the credential UID and send an anchor transaction to Sepolia.

Expected result: the credential is stored in Supabase and anchored on-chain.

### 3. Student creates a selective disclosure

1. Go to `/login`.
2. Choose the **Student** role.
3. Connect the Student wallet, or enter the Student wallet address in the Student portal.
4. Select the credential.
5. Tick the courses to disclose.
6. Click **Generate Merkle proofs**.
7. Copy the presentation JSON or click **Create share code**.

Expected result: the Student reveals only the selected courses. Hidden courses remain private while still being bound to the signed Merkle root.

### 4. Verifier verifies the credential

1. Go to `/login`.
2. Choose the **Verifier** role.
3. No wallet connection is required.
4. Click **Enter portal**.
5. Enter the share code or paste the presentation JSON.
6. Click **Verify**.

The verifier checks:

- The credential UID matches the metadata and Merkle root.
- The ECDSA signature recovers the claimed issuer address.
- The Merkle proofs for disclosed courses are valid.
- The issuer is currently authorized on-chain.
- The credential was anchored on-chain by the issuer.
- The credential has not been revoked.

## Login Role Checks

Current flow:

1. Choose a role first: Admin, University, Student, or Verifier.
2. Connect a wallet only if the selected role requires one.
3. The app checks the role rule:
   - Admin before setup: wallet must match `bootstrap_admin_wallet` in Supabase.
   - Admin after setup: wallet must match `contract.admin()`.
   - University: `authorizedIssuers[wallet]` must be `true`.
   - Student: any connected wallet is accepted.
   - Verifier: no wallet is required.
4. If the wallet does not match the selected role, the app shows a red warning and disables **Enter portal**.

## Useful Commands

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run format
```

## Demo Notes

- Admin and University wallets must be on Sepolia to send transactions.
- Before the first contract is saved, set `bootstrap_admin_wallet` in Supabase.
- Verifier does not need a wallet, but the app still needs a configured registry contract address to perform on-chain checks.
- If you deploy a new contract, save the new contract address in the Admin portal.
- If the University wallet is not authorized, the University login role check blocks portal entry.
- If a credential is revoked, the Verifier portal reports a failed revocation check.

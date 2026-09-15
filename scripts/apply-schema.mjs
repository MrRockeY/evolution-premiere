/**
 * Apply supabase/schema.sql using a Supabase personal access token.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *   node scripts/apply-schema.mjs
 *
 * Create a token at: https://supabase.com/dashboard/account/tokens
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function readEnv(name) {
  if (process.env[name]) return process.env[name].trim();
  try {
    const raw = readFileSync(resolve(root, ".env"), "utf8");
    const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : "";
  } catch {
    return "";
  }
}

const url = readEnv("VITE_SUPABASE_URL");
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim() || readEnv("SUPABASE_ACCESS_TOKEN");
const ref = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.(co|in)$/i)?.[1];

if (!ref) {
  console.error("Missing or invalid VITE_SUPABASE_URL in .env");
  process.exit(1);
}
if (!token) {
  console.error(
    "Set SUPABASE_ACCESS_TOKEN (Account → Access Tokens), then re-run:\n  node scripts/apply-schema.mjs",
  );
  process.exit(1);
}

const query = readFileSync(resolve(root, "supabase/schema.sql"), "utf8");
const endpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`;

console.log(`Applying schema to project ${ref}…`);

const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Failed (${res.status}):`, text);
  process.exit(1);
}

console.log("Schema applied successfully.");
console.log(text.slice(0, 400));

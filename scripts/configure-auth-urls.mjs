/**
 * Configure Supabase Auth URLs for the live Vercel site.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *   node scripts/configure-auth-urls.mjs
 *
 * Create a token: https://supabase.com/dashboard/account/tokens
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
const site = process.env.SITE_URL?.trim() || "https://evolution-premiere.vercel.app";
const extraSites = [
  "https://evolution-premiere-two.vercel.app",
  "https://evolution-premiere-two.vercel.app/**",
];

if (!ref) {
  console.error("Missing VITE_SUPABASE_URL");
  process.exit(1);
}
if (!token) {
  console.error("Set SUPABASE_ACCESS_TOKEN then re-run.");
  process.exit(1);
}

const allowList = [
  site,
  `${site}/**`,
  ...extraSites,
  "http://localhost:8080",
  "http://localhost:8080/**",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8080/**",
  "https://*.vercel.app",
  "https://*.vercel.app/**",
].join(",");

const endpoint = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
console.log(`Updating Auth URL config for ${ref}…`);

const res = await fetch(endpoint, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    site_url: site,
    uri_allow_list: allowList,
  }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Failed (${res.status}):`, text);
  process.exit(1);
}

console.log("Auth URLs configured:");
console.log(`  Site URL: ${site}`);
console.log(`  Allow list includes localhost + Vercel`);
console.log(text.slice(0, 500));

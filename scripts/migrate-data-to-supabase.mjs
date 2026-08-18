import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const confirmed = process.argv.includes("--confirm");
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sourcePath = path.resolve(process.cwd(), "data/data_store.json");
const collections = [
  "households",
  "residents",
  "changes",
  "businesses",
  "criteria",
  "logs",
  "allowedEmails",
  "pendingRegistrations",
  "documents",
  "dismissedEmails",
];

if (!confirmed) {
  console.error("Refusing to replace cloud records without --confirm.");
  process.exit(1);
}
if (!supabaseUrl || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY before running this migration.");
  process.exit(1);
}
if (!fs.existsSync(sourcePath)) {
  console.error(`Source data not found: ${sourcePath}`);
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

async function request(pathname, init = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
}

for (const collectionName of collections) {
  const items = Array.isArray(db[collectionName]) ? db[collectionName] : [];
  const records = items.map((item) => {
    const data = collectionName === "dismissedEmails" && typeof item === "string"
      ? { id: item, email: item }
      : item;
    if (!data?.id) return null;
    return { collection_name: collectionName, record_id: String(data.id), data };
  }).filter(Boolean);

  await request(`app_records?collection_name=eq.${encodeURIComponent(collectionName)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  for (let offset = 0; offset < records.length; offset += 500) {
    await request("app_records?on_conflict=collection_name,record_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(records.slice(offset, offset + 500)),
    });
  }
  console.log(`${collectionName}: ${records.length} records migrated`);
}

console.log("Supabase migration completed.");

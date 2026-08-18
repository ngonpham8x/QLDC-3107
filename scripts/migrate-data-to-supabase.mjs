import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const confirmed = process.argv.includes("--confirm");
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sourceFlagIndex = process.argv.indexOf("--source");
const sourceArgument = sourceFlagIndex === -1 ? "data/data_store.json" : process.argv[sourceFlagIndex + 1];
const sourcePath = path.resolve(process.cwd(), sourceArgument || "");
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
if (sourceFlagIndex !== -1 && (!sourceArgument || sourceArgument.startsWith("--"))) {
  console.error("Pass a JSON file path after --source.");
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
console.log(`Importing data from: ${sourcePath}`);
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
  return response;
}

async function loadRecordIds(collectionName) {
  const pageSize = 1_000;
  const recordIds = [];
  for (let offset = 0; ; offset += pageSize) {
    const response = await request(
      `app_records?select=record_id&collection_name=eq.${encodeURIComponent(collectionName)}&order=record_id.asc&limit=${pageSize}&offset=${offset}`,
    );
    const records = await response.json();
    if (!Array.isArray(records)) throw new Error(`Invalid Supabase response for ${collectionName}.`);
    recordIds.push(...records.map((record) => String(record.record_id)));
    if (records.length < pageSize) return recordIds;
  }
}

async function deleteRecords(collectionName, recordIds) {
  for (let offset = 0; offset < recordIds.length; offset += 100) {
    const quotedIds = recordIds
      .slice(offset, offset + 100)
      .map((id) => JSON.stringify(String(id)))
      .join(",");
    await request(
      `app_records?collection_name=eq.${encodeURIComponent(collectionName)}&record_id=${encodeURIComponent(`in.(${quotedIds})`)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
    );
  }
}

for (const collectionName of collections) {
  // User-facing backups intentionally omit access-control and audit data.
  // Preserve those cloud collections rather than accidentally revoking access.
  if (!Object.hasOwn(db, collectionName)) {
    console.log(`${collectionName}: skipped (not present in source)`);
    continue;
  }

  const existingRecordIds = await loadRecordIds(collectionName);
  const items = Array.isArray(db[collectionName]) ? db[collectionName] : [];
  const records = items.map((item) => {
    const data = collectionName === "dismissedEmails" && typeof item === "string"
      ? { id: item, email: item }
      : item;
    if (!data?.id) return null;
    return { collection_name: collectionName, record_id: String(data.id), data };
  }).filter(Boolean);

  for (let offset = 0; offset < records.length; offset += 500) {
    await request("app_records?on_conflict=collection_name,record_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(records.slice(offset, offset + 500)),
    });
  }

  // Do not create an empty-cloud window: new records are durable before only
  // stale records are removed. This also prevents serverless instances from
  // caching an incomplete collection during a migration.
  const currentRecordIds = new Set(records.map((record) => String(record.record_id)));
  const staleRecordIds = existingRecordIds.filter((id) => !currentRecordIds.has(id));
  await deleteRecords(collectionName, staleRecordIds);
  console.log(`${collectionName}: ${records.length} records migrated`);
}

console.log("Supabase migration completed.");

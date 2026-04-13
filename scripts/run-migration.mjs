import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const url = "https://bllypchfvmovgokgjfsj.supabase.co";
const key = "sb_secret_xFvhIdYsAHHOGx1oYqMRng_LbCotF_R";

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const sql = readFileSync(
  resolve("supabase/migrations/001_initial_schema.sql"),
  "utf-8"
);

// Split by semicolons and execute each statement
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log(`Found ${statements.length} SQL statements`);

let success = 0;
let failed = 0;

for (const stmt of statements) {
  try {
    const { error } = await supabase.rpc("exec_sql", { query: stmt + ";" });
    if (error) {
      // Try direct postgres query via fetch
      const res = await fetch(`${url}/rest/v1/`, {
        method: "GET",
        headers: { apikey: key },
      });
      throw new Error(error.message);
    }
    success++;
    process.stdout.write(".");
  } catch (err) {
    // exec_sql RPC doesn't exist on vanilla Supabase
    // We need a different approach
    failed++;
    if (failed === 1) {
      console.log("\nRPC not available, trying pg-meta API...");
      break;
    }
  }
}

if (failed > 0) {
  // Use Supabase pg-meta API
  console.log("Using pg-meta query endpoint...");

  const res = await fetch(`${url}/pg-meta/default/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    const data = await res.json();
    console.log("Migration completed successfully!");
    console.log("Result:", JSON.stringify(data).substring(0, 200));
  } else {
    const errText = await res.text();
    console.error("Migration failed:", res.status, errText.substring(0, 500));
  }
} else {
  console.log(`\nDone: ${success} statements executed`);
}

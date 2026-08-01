import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Kept in sync by hand with DATASET_URL in src/content.ts — the scraper
// repo (nepo-babies-scraper) publishes an already-gzipped file here weekly.
const DATASET_URL = "https://somelikeitchott.github.io/nepo-babies-scraper/nepo-babies.json.gz";
const destination = path.join(__dirname, "..", "data", "nepo-babies.json.gz");

const res = await fetch(DATASET_URL);
if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status}`);
writeFileSync(destination, Buffer.from(await res.arrayBuffer()));

console.log(`Downloaded ${DATASET_URL} -> ${destination}`);

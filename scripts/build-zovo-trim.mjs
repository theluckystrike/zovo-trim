// Copyright (C) 2026 Zovo.one contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "trim-src");
const output = path.join(root, "dist");
const publicKey = process.env.SUPABASE_ANON_KEY?.trim();

if (!publicKey) {
    throw new Error("SUPABASE_ANON_KEY must be set at build time");
}
if (/sb_secret_|service_role/i.test(publicKey)) {
    throw new Error("Only a public Supabase anonymous or publishable key may be packaged");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, {
    recursive: true,
    filter: (entry) => !entry.endsWith(".template.js"),
});

const backgroundTemplate = await readFile(path.join(source, "tfg-license-worker.template.js"), "utf8");
const builtBackground = backgroundTemplate.replaceAll("__TRIM_BUILD_PUBLIC_KEY__", JSON.stringify(publicKey));
await writeFile(path.join(output, "tfg-license-worker.js"), builtBackground, "utf8");

const unresolved = [];
for (const file of ["tfg-license-worker.js", "manifest.json"]) {
    const value = await readFile(path.join(output, file), "utf8");
    if (value.includes("__TRIM_BUILD_PUBLIC_KEY__")) unresolved.push(file);
}
if (unresolved.length) {
    throw new Error(`Unresolved build value in: ${unresolved.join(", ")}`);
}

await cp(path.join(root, "LICENSE"), path.join(output, "LICENSE"));
console.log(`Built Zovo Trim MV3 package at ${output}`);

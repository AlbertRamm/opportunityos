"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getInterests, requireAdmin } from "@/lib/data";
import { fillCoordinates } from "@/lib/geo";
import { normalizeUrlKey, parseBatch } from "@/lib/import-parse";
import { str } from "@/lib/forms";

export interface ImportRowResult {
  index: number;
  title: string;
  status: "ok" | "error" | "duplicate" | "created" | "failed";
  messages: string[];
}
export interface ImportState {
  error?: string;
  mode?: "preview" | "commit";
  results?: ImportRowResult[];
  json?: string;
  batch?: string;
}

function programKey(title: string, organization: string, source: string, cycle: string | null) {
  return JSON.stringify([title.trim().toLowerCase(), organization.trim().toLowerCase(), normalizeUrlKey(source), cycle]);
}

/**
 * Admin-only. Creates UNVERIFIED drafts + an evidence row each. Students never see drafts (RLS);
 * a human verifies each one in the edit form after comparing it to the cited source.
 */
export async function importBatch(_prev: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  const json = str(fd, "json");
  const batch = str(fd, "batch");
  const mode = str(fd, "intent") === "commit" ? "commit" : "preview";
  if (!json) return { error: "Paste a JSON batch.", json, batch };
  if (mode === "commit" && !/^[a-z0-9][a-z0-9._-]{2,60}$/i.test(batch)) {
    return { error: "Give the batch a short name like 2026-10-dmv-batch-1 (letters, digits, . _ -).", json, batch, mode };
  }

  const interests = new Set((await getInterests()).map((i) => i.slug));
  const parsed = parseBatch(json, interests);
  if (!parsed.ok) return { error: parsed.error, json, batch, mode };

  const supabase = await createClient();
  const { data: existing, error: exErr } = await supabase.from("opportunities").select("title,organization,source_url,program_start_date,application_deadline");
  if (exErr) return { error: `Could not check for duplicates: ${exErr.message}`, json, batch, mode };
  const known = new Set((existing ?? []).filter((r) => r.source_url).map((r) =>
    programKey(r.title, r.organization, r.source_url, r.program_start_date ?? r.application_deadline)));
  const seenInBatch = new Set<string>();

  const results: ImportRowResult[] = [];
  for (const rec of parsed.records) {
    const msgs = Object.entries(rec.errors).map(([k, v]) => `${k}: ${v}`);
    const key = programKey(rec.title, String(rec.row.organization ?? ""), String(rec.row.source_url ?? ""),
      (rec.row.program_start_date ?? rec.row.application_deadline ?? null) as string | null);
    if (msgs.length > 0) {
      results.push({ index: rec.index, title: rec.title, status: "error", messages: msgs });
      continue;
    }
    if (known.has(key) || seenInBatch.has(key)) {
      results.push({ index: rec.index, title: rec.title, status: "duplicate", messages: ["This program and cycle already exist or appear twice in this batch. Skipped."] });
      continue;
    }
    seenInBatch.add(key);
    if (mode === "preview") {
      results.push({ index: rec.index, title: rec.title, status: "ok", messages: [] });
      continue;
    }
    await fillCoordinates(rec.row);
    const { data, error } = await supabase.rpc("import_opportunity_draft", {
      p_listing: rec.row,
      p_batch: batch,
      p_evidence: rec.evidence,
    });
    if (error || !data) {
      results.push({ index: rec.index, title: rec.title, status: "failed", messages: [error?.message ?? "insert failed"] });
      continue;
    }
    results.push({
      index: rec.index,
      title: rec.title,
      status: "created",
      messages: [data],
    });
  }
  if (mode === "commit") {
    revalidatePath("/admin");
  }
  return { mode, results, json, batch };
}

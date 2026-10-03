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

/**
 * Admin-only. Creates UNVERIFIED drafts + an evidence row each. Students never see drafts (RLS);
 * a human verifies each one in the edit form after comparing it to the cited source.
 */
export async function importBatch(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const admin = await requireAdmin();
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
  const { data: existing, error: exErr } = await supabase.from("opportunities").select("source_url,application_url");
  if (exErr) return { error: `Could not check for duplicates: ${exErr.message}`, json, batch, mode };
  const known = new Set((existing ?? []).flatMap((r) => [r.source_url, r.application_url]).filter(Boolean).map((u) => normalizeUrlKey(u as string)));
  const seenInBatch = new Set<string>();

  const results: ImportRowResult[] = [];
  for (const rec of parsed.records) {
    const msgs = Object.entries(rec.errors).map(([k, v]) => `${k}: ${v}`);
    const key = rec.row.source_url ? normalizeUrlKey(rec.row.source_url as string) : "";
    if (msgs.length > 0) {
      results.push({ index: rec.index, title: rec.title, status: "error", messages: msgs });
      continue;
    }
    if (known.has(key) || seenInBatch.has(key)) {
      results.push({ index: rec.index, title: rec.title, status: "duplicate", messages: ["An opportunity with this source/application URL already exists (or appears twice in this batch). Skipped."] });
      continue;
    }
    seenInBatch.add(key);
    if (mode === "preview") {
      results.push({ index: rec.index, title: rec.title, status: "ok", messages: [] });
      continue;
    }
    await fillCoordinates(rec.row);
    const { data, error } = await supabase
      .from("opportunities")
      .insert({ ...rec.row, verification_status: "unverified", created_by: admin.id })
      .select("id")
      .single();
    if (error || !data) {
      results.push({ index: rec.index, title: rec.title, status: "failed", messages: [error?.message ?? "insert failed"] });
      continue;
    }
    const { error: evErr } = await supabase
      .from("opportunity_admin")
      .insert({ opportunity_id: data.id, import_batch: batch, source_evidence: rec.evidence });
    results.push({
      index: rec.index,
      title: rec.title,
      status: evErr ? "failed" : "created",
      messages: evErr ? [`Draft created but evidence not saved: ${evErr.message}`] : [data.id],
    });
  }
  if (mode === "commit") {
    revalidatePath("/admin");
  }
  return { mode, results, json, batch };
}

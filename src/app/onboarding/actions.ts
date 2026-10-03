"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getInterests, getProfileRow, requireUser } from "@/lib/data";
import { ageOn, isIsoDate, todayET } from "@/lib/dates";
import { list, str, type FormState } from "@/lib/forms";
import { lookupZip } from "@/lib/geo";
import { trackEvent } from "@/lib/analytics";
import { OPPORTUNITY_TYPES } from "@/lib/matching/types";

const schema = z.object({
  first_name: z.string().min(1, "Enter your first name").max(60),
  birth_date: z.string().refine(isIsoDate, "Enter your birth date"),
  grade: z.coerce.number().int().min(9, "Choose your grade").max(12, "Choose your grade"),
  graduation_year: z.coerce.number().int(),
  zip: z.string().regex(/^\d{5}$/, "Enter a 5-digit ZIP code"),
  state: z.enum(["DC", "MD", "VA", "OTHER"], { error: "Choose where you live" }),
  school_name: z.string().min(1, "Enter your school name").max(120),
  interests: z.array(z.string()).min(1, "Pick at least one interest"),
  opportunity_types: z.array(z.enum(OPPORTUNITY_TYPES)).min(1, "Pick at least one type"),
  pay_preference: z.enum(["paid_only", "prefer_paid", "either"], { error: "Choose one" }),
  work_mode_preference: z.enum(["in_person", "remote", "either"], { error: "Choose one" }),
  max_travel_miles: z.coerce.number().refine((n) => [5, 10, 25, 50].includes(n), "Choose one"),
  available_school_year: z.boolean(),
  available_summer: z.boolean(),
});

export type ProfileFormState = FormState<Record<string, string | string[]>>;

export async function saveProfile(_prev: ProfileFormState, fd: FormData): Promise<ProfileFormState> {
  const user = await requireUser();
  const values: Record<string, string | string[]> = {
    first_name: str(fd, "first_name"),
    birth_date: str(fd, "birth_date"),
    grade: str(fd, "grade"),
    graduation_year: str(fd, "graduation_year"),
    zip: str(fd, "zip"),
    state: str(fd, "state"),
    school_name: str(fd, "school_name"),
    interests: list(fd, "interests"),
    opportunity_types: list(fd, "opportunity_types"),
    pay_preference: str(fd, "pay_preference"),
    work_mode_preference: str(fd, "work_mode_preference"),
    max_travel_miles: str(fd, "max_travel_miles"),
    available_school_year: fd.get("available_school_year") === "on" ? "on" : "",
    available_summer: fd.get("available_summer") === "on" ? "on" : "",
    email_reminders: fd.get("email_reminders") === "on" ? "on" : "",
  };

  const parsed = schema.safeParse({
    ...values,
    available_school_year: values.available_school_year === "on",
    available_summer: values.available_summer === "on",
  });
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { values, fieldErrors, error: "Please fix the highlighted fields." };
  }
  const p = parsed.data;
  const today = todayET();

  // Plausibility checks that protect match accuracy.
  const age = ageOn(p.birth_date, today);
  if (age < 13) fieldErrors.birth_date = "OpportunityOS is for students 13 and older.";
  else if (age > 20) fieldErrors.birth_date = "OpportunityOS is currently for high-school students.";
  const thisYear = +today.slice(0, 4);
  if (p.graduation_year < thisYear || p.graduation_year > thisYear + 5) fieldErrors.graduation_year = "Enter a realistic graduation year";
  if (!p.available_school_year && !p.available_summer) fieldErrors.available_summer = "Pick at least one: school year or summer";

  const validInterests = new Set((await getInterests()).map((i) => i.slug));
  if (p.interests.some((i) => !validInterests.has(i))) fieldErrors.interests = "One of those interests isn't valid";

  const geo = await lookupZip(p.zip);
  if (geo && p.state !== "OTHER" && geo.state !== p.state) {
    fieldErrors.state = `ZIP ${p.zip} is in ${geo.state}, not ${p.state}. Check both fields — matching depends on this.`;
  }
  if (Object.keys(fieldErrors).length > 0) return { values, fieldErrors, error: "Please fix the highlighted fields." };

  const existing = await getProfileRow();
  const supabase = await createClient();
  const record = {
      user_id: user.id,
      first_name: p.first_name,
      birth_date: p.birth_date,
      grade: p.grade,
      graduation_year: p.graduation_year,
      zip: p.zip,
      state: p.state,
      school_name: p.school_name,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      interests: p.interests,
      opportunity_types: p.opportunity_types,
      pay_preference: p.pay_preference,
      work_mode_preference: p.work_mode_preference,
      max_travel_miles: p.max_travel_miles,
      available_school_year: p.available_school_year,
      available_summer: p.available_summer,
      email_reminders: values.email_reminders === "on",
      onboarding_completed_at: existing?.onboarding_completed_at ?? new Date().toISOString(),
  };
  let { error } = await supabase.from("profiles").upsert(record, { onConflict: "user_id" });
  if (error && /email_reminders/.test(error.message)) {
    // Deploy-order safety: code can ship before migration 20261004 is applied. Save everything else.
    console.warn("[profile] email_reminders column missing; apply migration 20261004000000. Saving without it.");
    const { email_reminders: _omit, ...rest } = record;
    void _omit;
    ({ error } = await supabase.from("profiles").upsert(rest, { onConflict: "user_id" }));
  }
  if (error) {
    console.error("[profile] upsert failed", error.message);
    return { values, error: "We couldn't save your profile. Please try again." };
  }
  if (!existing?.onboarding_completed_at) await trackEvent("onboarding_completed");
  revalidatePath("/", "layout");
  redirect(existing?.onboarding_completed_at ? "/dashboard" : "/dashboard?welcome=1");
}

export async function deleteAccount(): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("[account] delete failed", error.message);
    throw new Error("Could not delete your account. Please try again.");
  }
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}

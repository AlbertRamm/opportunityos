"use client";

import { createContext, useActionState, useContext } from "react";
import { saveOpportunity, type OppFormState } from "@/app/(admin)/admin/actions";
import { button, card, hint, input, label } from "./ui";
import { chip } from "./ui";

const TYPES: [string, string][] = [
  ["internship", "Internship"], ["job", "Job"], ["summer_program", "Summer program"], ["research", "Research"],
  ["scholarship", "Scholarship"], ["apprenticeship", "Apprenticeship"], ["competition", "Competition"],
  ["volunteering", "Volunteering / service"], ["pre_college", "Pre-college program"], ["other", "Other"],
];

export function OpportunityForm({
  initial,
  interests,
  id,
  verified,
}: {
  initial: Record<string, string | string[]>;
  interests: { slug: string; label: string }[];
  id?: string;
  verified: boolean;
}) {
  const [state, action, pending] = useActionState<OppFormState, FormData>(saveOpportunity, { values: initial });
  const v = state.values ?? initial;
  const e = state.fieldErrors ?? {};
  const arr = (k: string) => (Array.isArray(v[k]) ? (v[k] as string[]) : []);
  const s = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");

  return (
    <FormCtx.Provider value={{ v, e }}>
    <form action={action} className="space-y-6">
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{state.error}</p>}

      <Section title="Basics">
        <F name="title" text="Title" required />
        <F name="organization" text="Organization" required />
        <div>
          <label htmlFor="opportunity_type" className={label}>Type</label>
          <select id="opportunity_type" name="opportunity_type" required defaultValue={s("opportunity_type")} className={input}>
            <option value="" disabled>Choose…</option>
            {TYPES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          {e.opportunity_type && <p role="alert" className="mt-1 text-sm text-red-700">{e.opportunity_type}</p>}
        </div>
        <F name="description" text="Description" area rows={6} help="Plain-language summary written from the official page." />
        <div className="grid gap-5 sm:grid-cols-2">
          <F name="application_url" text="Application URL" type="url" help="Where the student applies. Required to verify." />
          <F name="source_url" text="Source URL" type="url" help="The official page you verified against. Required to verify." />
        </div>
        <fieldset>
          <legend className={label}>Interests / categories</legend>
          <div className="flex flex-wrap gap-2">
            {interests.map((i) => (
              <label key={i.slug} className={chip}>
                <input type="checkbox" name="interests" value={i.slug} defaultChecked={arr("interests").includes(i.slug)} className="sr-only" />{i.label}
              </label>
            ))}
          </div>
          {e.interests && <p role="alert" className="mt-1 text-sm text-red-700">{e.interests}</p>}
        </fieldset>
      </Section>

      <Section title="Hard eligibility" note="Only enter what the official page explicitly states. Leave blank when not stated — never guess. Anything you can't encode goes in “Other requirements”.">
        <div className="grid gap-5 sm:grid-cols-4">
          <F name="min_age" text="Min age" type="number" min={0} max={120} />
          <F name="max_age" text="Max age" type="number" min={0} max={120} />
          <F name="min_grade" text="Min grade" type="number" min={1} max={12} help="Grade at time of application." />
          <F name="max_grade" text="Max grade" type="number" min={1} max={12} />
        </div>
        <F name="age_reference_date" text="Age as-of date" type="date" help="Only if the page says e.g. “must be 16 by June 1”." />
        <F name="eligible_graduation_years" text="Eligible graduation years" help="Comma-separated, e.g. 2027, 2028. Blank = not stated." />
        <div className="grid gap-5 sm:grid-cols-2">
          <F name="allowed_states" text="Residency: allowed states" help="Two-letter codes, e.g. DC, MD, VA." />
          <F name="allowed_zips" text="Residency: allowed ZIP codes" help="Comma-separated 5-digit ZIPs." />
        </div>
        <F name="allowed_counties" text="Residency: allowed counties / cities" area rows={2} help="One per line. Students can't be auto-checked against these, so they will see “Check Requirement”." />
        <F name="residency_notes" text="Residency note (free text)" help="Shown to students; flagged as needing confirmation." />
        <div className="grid gap-5 sm:grid-cols-3">
          <Sel name="citizenship_requirement" text="Citizenship requirement" options={[["us_citizen", "U.S. citizen"], ["us_citizen_or_permanent_resident", "U.S. citizen or permanent resident"], ["work_authorization", "U.S. work authorization"]]} help="Only if explicitly stated." />
          <F name="min_gpa" text="Minimum GPA" type="number" step="0.01" min={0} max={5} help="Only if explicitly stated." />
          <Sel name="schedule_period" text="When it runs" options={[["school_year", "School year"], ["summer", "Summer"], ["both", "School year and summer"], ["flexible", "Flexible"]]} help="Used to check student availability." />
        </div>
        <F name="unstructured_requirements" text="Other requirements" area rows={3} help="One per line (e.g. “Must attend a public high school”, “Teacher recommendation”). Each shows students a “?” and forces Check Requirement." />
        <F name="additional_eligibility_notes" text="Additional eligibility notes" area rows={2} help="Informational." />
      </Section>

      <Section title="Location & pay">
        <div className="grid gap-5 sm:grid-cols-2">
          <F name="location_name" text="Place name" placeholder="e.g. Main campus" />
          <Sel name="work_mode" text="Format" options={[["in_person", "In person"], ["remote", "Remote"], ["hybrid", "Hybrid"]]} />
          <F name="location_city" text="City" />
          <F name="location_state" text="State" help="2 letters" />
          <F name="location_zip" text="ZIP" help="We look up approximate coordinates from this for distance." />
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Override coordinates manually</summary>
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            <F name="location_lat" text="Latitude" /> <F name="location_lng" text="Longitude" />
          </div>
        </details>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="is_paid" className={label}>Paid?</label>
            <select id="is_paid" name="is_paid" defaultValue={s("is_paid")} className={input}>
              <option value="">Unknown / not applicable</option>
              <option value="yes">Paid</option>
              <option value="no">Unpaid</option>
            </select>
            <p className={hint}>Use “not applicable” for scholarships and competitions.</p>
          </div>
          <F name="compensation_description" text="Compensation details" placeholder="e.g. $18/hour, or $2,000 award" />
        </div>
      </Section>

      <Section title="Dates">
        <div className="grid gap-5 sm:grid-cols-2">
          <F name="application_open_date" text="Applications open" type="date" />
          <F name="application_deadline" text="Application deadline" type="date" help="Last day to apply. Blank = rolling/unlisted." />
          <F name="program_start_date" text="Program start" type="date" />
          <F name="program_end_date" text="Program end" type="date" />
        </div>
      </Section>

      <Section title="Verification" note="Students only see verified listings. Verify only after checking every field against the source URL.">
        <F name="last_verified_on" text="Last verified on" type="date" help="Defaults to today when you click “Save & verify”." />
        <div className="flex flex-wrap gap-3">
          <button name="intent" value="verify" className={button("accent")} disabled={pending}>{verified ? "Save & re-verify today" : "Save & verify"}</button>
          <button name="intent" value="save" className={button("secondary")} disabled={pending}>{id ? "Save (keep verification status)" : "Save as draft"}</button>
          {id && verified && <button name="intent" value="unverify" className={button("danger")} disabled={pending}>Save &amp; unverify (hide from students)</button>}
        </div>
        {pending && <p role="status" className="text-sm text-muted">Saving…</p>}
      </Section>
    </form>
    </FormCtx.Provider>
  );
}

const FormCtx = createContext<{ v: Record<string, string | string[]>; e: Record<string, string> }>({ v: {}, e: {} });
const useVal = (k: string) => {
  const { v, e } = useContext(FormCtx);
  return { val: typeof v[k] === "string" ? (v[k] as string) : "", err: e[k] };
};

function F({ name, text, type = "text", help, area = false, rows = 3, ...rest }: { name: string; text: string; type?: string; help?: string; area?: boolean; rows?: number; required?: boolean; placeholder?: string; min?: number; max?: number; step?: string }) {
  const { val, err } = useVal(name);
  return (
    <div>
      <label htmlFor={name} className={label}>{text}</label>
      {area ? (
        <textarea id={name} name={name} rows={rows} defaultValue={val} className={input} aria-describedby={`${name}-d`} {...rest} />
      ) : (
        <input id={name} name={name} type={type} defaultValue={val} className={input} aria-describedby={`${name}-d`} {...rest} />
      )}
      <div id={`${name}-d`}>
        {help && <p className={hint}>{help}</p>}
        {err && <p role="alert" className="mt-1 text-sm text-red-700">{err}</p>}
      </div>
    </div>
  );
}

function Sel({ name, text, options, help }: { name: string; text: string; options: [string, string][]; help?: string }) {
  const { val, err } = useVal(name);
  return (
    <div>
      <label htmlFor={name} className={label}>{text}</label>
      <select id={name} name={name} defaultValue={val} className={input} aria-describedby={`${name}-d`}>
        <option value="">Not stated</option>
        {options.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
      </select>
      <div id={`${name}-d`}>{help && <p className={hint}>{help}</p>}{err && <p role="alert" className="mt-1 text-sm text-red-700">{err}</p>}</div>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <fieldset className={`${card} space-y-5 p-6`}>
      <legend className="px-1 text-lg font-semibold">{title}</legend>
      {note && <p className={hint + " -mt-2"}>{note}</p>}
      {children}
    </fieldset>
  );
}


"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveProfile, type ProfileFormState } from "@/app/onboarding/actions";
import { button, chip, hint, input, label } from "./ui";

export interface ProfileFormProps {
  interests: { slug: string; label: string }[];
  initial: Record<string, string | string[]>;
  gradYearByGrade: Record<string, number>;
  maxBirthDate: string;
  minBirthDate: string;
  submitLabel: string;
}

const TYPE_OPTIONS: [string, string][] = [
  ["internship", "Internships"],
  ["job", "Jobs (paid work)"],
  ["summer_program", "Summer programs"],
  ["research", "Research"],
  ["scholarship", "Scholarships"],
  ["apprenticeship", "Apprenticeships"],
  ["competition", "Competitions"],
  ["volunteering", "Volunteering / service"],
  ["pre_college", "Pre-college programs"],
];

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? <p id={id} role="alert" className="mt-1.5 text-sm text-red-700">{msg}</p> : null;
}

export function ProfileForm({ interests, initial, gradYearByGrade, maxBirthDate, minBirthDate, submitLabel }: ProfileFormProps) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfile, { values: initial });
  const v = state.values ?? initial;
  const e = state.fieldErrors ?? {};
  const gradYearTouched = useRef(Boolean(initial.graduation_year));
  const gradYearRef = useRef<HTMLInputElement>(null);
  const s = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
  const a = (k: string) => (Array.isArray(v[k]) ? (v[k] as string[]) : []);

  // key: React resets the form after an action and <select> ignores a changed defaultValue,
  // so remount with the returned values to keep what the student typed.
  return (
    <form key={JSON.stringify(state.values ?? {})} action={action} className="space-y-12">
      {state.error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{state.error}</p>
      )}

      <fieldset className="space-y-5">
        <legend className="text-xl font-semibold">About you</legend>
        <div>
          <label htmlFor="first_name" className={label}>First name</label>
          <input id="first_name" name="first_name" required maxLength={60} autoComplete="given-name" defaultValue={s("first_name")} className={input} aria-describedby="first_name-err" />
          <FieldError id="first_name-err" msg={e.first_name} />
        </div>
        <div>
          <label htmlFor="birth_date" className={label}>Birth date</label>
          <input id="birth_date" name="birth_date" type="date" required min={minBirthDate} max={maxBirthDate} defaultValue={s("birth_date")} className={input} aria-describedby="birth_date-hint birth_date-err" />
          <p id="birth_date-hint" className={hint}>Many programs have age rules, so we use this to check them. We never show it to anyone.</p>
          <FieldError id="birth_date-err" msg={e.birth_date} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="grade" className={label}>Current grade</label>
            <select
              id="grade" name="grade" required defaultValue={s("grade")} className={input} aria-describedby="grade-err"
              onChange={(ev) => {
                const y = gradYearByGrade[ev.target.value];
                if (y && gradYearRef.current && !gradYearTouched.current) gradYearRef.current.value = String(y);
              }}
            >
              <option value="" disabled>Choose…</option>
              {[9, 10, 11, 12].map((g) => <option key={g} value={g}>{g}th grade</option>)}
            </select>
            <FieldError id="grade-err" msg={e.grade} />
          </div>
          <div>
            <label htmlFor="graduation_year" className={label}>Expected graduation year</label>
            <input ref={gradYearRef} id="graduation_year" name="graduation_year" type="number" inputMode="numeric" required defaultValue={s("graduation_year")} onChange={() => (gradYearTouched.current = true)} className={input} aria-describedby="graduation_year-err" />
            <FieldError id="graduation_year-err" msg={e.graduation_year} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-xl font-semibold">Where you live</legend>
        <p className={hint + " -mt-3"}>Just a ZIP code — never your street address.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="zip" className={label}>ZIP code</label>
            <input id="zip" name="zip" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required autoComplete="postal-code" defaultValue={s("zip")} className={input} aria-describedby="zip-err" />
            <FieldError id="zip-err" msg={e.zip} />
          </div>
          <div>
            <label htmlFor="state" className={label}>State</label>
            <select id="state" name="state" required defaultValue={s("state")} className={input} aria-describedby="state-err">
              <option value="" disabled>Choose…</option>
              <option value="DC">Washington, DC</option>
              <option value="MD">Maryland</option>
              <option value="VA">Virginia</option>
              <option value="OTHER">Somewhere else</option>
            </select>
            <FieldError id="state-err" msg={e.state} />
          </div>
        </div>
        <div>
          <label htmlFor="school_name" className={label}>School name</label>
          <input id="school_name" name="school_name" required maxLength={120} defaultValue={s("school_name")} className={input} aria-describedby="school_name-err" />
          <FieldError id="school_name-err" msg={e.school_name} />
        </div>
      </fieldset>

      <fieldset className="space-y-4" aria-describedby="interests-err">
        <legend className="text-xl font-semibold">What are you interested in?</legend>
        <p className={hint + " -mt-2"}>Pick all that apply.</p>
        <div className="flex flex-wrap gap-2.5">
          {interests.map((i) => (
            <label key={i.slug} className={chip}>
              <input type="checkbox" name="interests" value={i.slug} defaultChecked={a("interests").includes(i.slug)} className="sr-only" />
              {i.label}
            </label>
          ))}
        </div>
        <FieldError id="interests-err" msg={e.interests} />
      </fieldset>

      <fieldset className="space-y-4" aria-describedby="types-err">
        <legend className="text-xl font-semibold">What are you looking for?</legend>
        <p className={hint + " -mt-2"}>Pick all that apply.</p>
        <div className="flex flex-wrap gap-2.5">
          {TYPE_OPTIONS.map(([val, text]) => (
            <label key={val} className={chip}>
              <input type="checkbox" name="opportunity_types" value={val} defaultChecked={a("opportunity_types").includes(val)} className="sr-only" />
              {text}
            </label>
          ))}
        </div>
        <FieldError id="types-err" msg={e.opportunity_types} />
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="text-xl font-semibold">Your preferences</legend>
        <p className={hint + " -mt-3"}>These help us rank results. They never hide you from things you&apos;re eligible for.</p>
        <RadioGroup name="pay_preference" legend="Pay" value={s("pay_preference")} error={e.pay_preference}
          options={[["paid_only", "Paid only"], ["prefer_paid", "Prefer paid"], ["either", "Either is fine"]]} />
        <RadioGroup name="work_mode_preference" legend="Where" value={s("work_mode_preference")} error={e.work_mode_preference}
          options={[["in_person", "In person"], ["remote", "Remote"], ["either", "Either"]]} />
        <RadioGroup name="max_travel_miles" legend="Maximum travel distance" value={s("max_travel_miles")} error={e.max_travel_miles}
          options={[["5", "5 miles"], ["10", "10 miles"], ["25", "25 miles"], ["50", "50+ miles"]]} />
        <fieldset aria-describedby="avail-err">
          <legend className={label}>When are you available?</legend>
          <div className="flex flex-wrap gap-2.5">
            <label className={chip}><input type="checkbox" name="available_school_year" defaultChecked={s("available_school_year") === "on"} className="sr-only" />During the school year</label>
            <label className={chip}><input type="checkbox" name="available_summer" defaultChecked={s("available_summer") === "on"} className="sr-only" />During the summer</label>
          </div>
          <FieldError id="avail-err" msg={e.available_summer} />
        </fieldset>
      </fieldset>

      <MatchDetails s={s} e={e} />

      <fieldset className="space-y-2">
        <legend className="text-xl font-semibold">Reminders</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="email_reminders" defaultChecked={"email_reminders" in v ? s("email_reminders") === "on" : true} className="mt-1 h-5 w-5 shrink-0" />
          <span>Email me when an opportunity I saved is 7 days and 2 days from its deadline. <span className="text-muted">One email each, never for ones you&apos;ve applied to. You can turn this off any time.</span></span>
        </label>
      </fieldset>

      <button className={button("accent") + " w-full sm:w-auto px-8 py-3.5 text-base"} disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

const YES_NO: [string, string][] = [["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"], ["prefer_not", "Prefer not to say"]];

/** Optional, skippable, removable. Blank = nothing stored. Onboarding never depends on it. */
function MatchDetails({ s, e }: { s: (k: string) => string; e: Record<string, string> }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const filled = ["gpa_value", "attest_financial_need", "attest_citizenship", "college_plan"].some((k) => s(k) !== "");
  const hasError = ["gpa_value", "gpa_scale", "gpa_weighting"].some((k) => e[k]);
  useEffect(() => {
    if (window.location.hash === "#match-details" && ref.current) ref.current.open = true;
  }, []);
  return (
    <details ref={ref} id="match-details" open={filled || hasError} className="rounded-2xl border border-line bg-surface p-5 open:pb-6">
      <summary className="cursor-pointer text-xl font-semibold">
        Match details <span className="text-base font-normal text-muted">(optional)</span>
      </summary>
      <div className="mt-4 space-y-8">
        <p className={hint}>
          Skip this whole section if you like. These answers only help us tell you more precisely whether you meet a rule, such as a GPA minimum, so fewer
          opportunities say &ldquo;check requirement.&rdquo; They stay in your account, are <strong>never shared with the programs or scholarship providers</strong>,
          and leaving them blank or choosing &ldquo;prefer not to say&rdquo; never hides an opportunity or lowers a match. You can change or clear them any time.
        </p>

        <fieldset className="space-y-3">
          <legend className={label}>Your GPA</legend>
          <p id="gpa-help" className={hint}>
            As shown on your report card or transcript. Many scholarships set a minimum. We never assume whether it&apos;s weighted, so tell us which kind it is. To remove it, clear the GPA box.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="gpa_value" className="mb-1 block text-sm font-medium">GPA</label>
              <input id="gpa_value" name="gpa_value" inputMode="decimal" maxLength={6} placeholder="e.g. 3.6" defaultValue={s("gpa_value")} className={input} aria-describedby="gpa-help gpa_value-err" />
              <FieldError id="gpa_value-err" msg={e.gpa_value} />
            </div>
            <div>
              <label htmlFor="gpa_scale" className="mb-1 block text-sm font-medium">Scale your school uses</label>
              <select id="gpa_scale" name="gpa_scale" defaultValue={s("gpa_scale")} className={input} aria-describedby="gpa_scale-err">
                <option value="">Choose…</option>
                <option value="4.0">Out of 4.0 (most common)</option>
                <option value="5.0">Out of 5.0</option>
                <option value="100">Out of 100</option>
                <option value="other">Something else</option>
              </select>
              <FieldError id="gpa_scale-err" msg={e.gpa_scale} />
            </div>
          </div>
          <OptionalRadios name="gpa_weighting" legend="Is that GPA weighted?" value={s("gpa_weighting")} error={e.gpa_weighting} skip={false}
            options={[["unweighted", "Unweighted"], ["weighted", "Weighted (honors/AP boost)"], ["not_sure", "Not sure"]]} />
        </fieldset>

        <OptionalRadios name="attest_financial_need" legend="Do you think you'd qualify for need-based scholarships?" value={s("attest_financial_need")} options={YES_NO}
          help="Just your own view. We never ask about family income, taxes, or financial forms. Each sponsor decides what counts as need, so this only helps us show which scholarships ask for it." />

        <OptionalRadios name="attest_citizenship" legend="I meet U.S. citizenship or permanent-residency requirements commonly used by scholarships." value={s("attest_citizenship")} options={YES_NO}
          help="We don't ask for, and never store, your citizenship or immigration status. This one answer is only used to check scholarships that require it. You still need to confirm each sponsor's exact rule, and some accept other statuses." />

        <OptionalRadios name="college_plan" legend="After high school, I plan to attend…" value={s("college_plan")}
          options={[["four_year", "A four-year college or university"], ["two_year_or_vocational", "A two-year, community, or vocational program"], ["undecided", "Undecided"], ["prefer_not", "Prefer not to say"]]}
          help="Many scholarships are for students headed to college. Plans can change, and this never rules anything out." />
      </div>
    </details>
  );
}

function OptionalRadios({ name, legend, value, options, help, error, skip = true }: { name: string; legend: string; value: string; options: [string, string][]; help?: string; error?: string; skip?: boolean }) {
  return (
    <fieldset aria-describedby={`${name}-help ${name}-err`}>
      <legend className={label}>{legend}</legend>
      {help && <p id={`${name}-help`} className={hint + " mb-2"}>{help}</p>}
      <div className="flex flex-wrap gap-2.5">
        {skip && (
          <label className={chip}>
            <input type="radio" name={name} value="" defaultChecked={value === ""} className="sr-only" />
            Skip
          </label>
        )}
        {options.map(([val, text]) => (
          <label key={val} className={chip}>
            <input type="radio" name={name} value={val} defaultChecked={value === val} className="sr-only" />
            {text}
          </label>
        ))}
      </div>
      <FieldError id={`${name}-err`} msg={error} />
    </fieldset>
  );
}

function RadioGroup({ name, legend, value, options, error }: { name: string; legend: string; value: string; options: [string, string][]; error?: string }) {
  return (
    <fieldset aria-describedby={`${name}-err`}>
      <legend className={label}>{legend}</legend>
      <div className="flex flex-wrap gap-2.5">
        {options.map(([val, text]) => (
          <label key={val} className={chip}>
            <input type="radio" name={name} value={val} defaultChecked={value === val} required className="sr-only" />
            {text}
          </label>
        ))}
      </div>
      <FieldError id={`${name}-err`} msg={error} />
    </fieldset>
  );
}

"use client";

import { useActionState, useRef } from "react";
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

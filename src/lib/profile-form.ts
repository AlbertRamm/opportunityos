import "server-only";
import { addDays, expectedGraduationYear, todayET } from "@/lib/dates";
import type { ProfileRow } from "@/lib/data";

export function profileFormProps() {
  const today = todayET();
  return {
    gradYearByGrade: Object.fromEntries([9, 10, 11, 12].map((g) => [String(g), expectedGraduationYear(g, today)])),
    maxBirthDate: addDays(today, -13 * 365),
    minBirthDate: addDays(today, -21 * 366),
  };
}

export function profileToFormValues(p: ProfileRow): Record<string, string | string[]> {
  return {
    first_name: p.first_name,
    birth_date: p.birth_date,
    grade: String(p.grade),
    graduation_year: String(p.graduation_year),
    zip: p.zip,
    state: p.state,
    school_name: p.school_name,
    interests: p.interests,
    opportunity_types: p.opportunity_types,
    pay_preference: p.pay_preference,
    work_mode_preference: p.work_mode_preference,
    max_travel_miles: String(p.max_travel_miles),
    available_school_year: p.available_school_year ? "on" : "",
    available_summer: p.available_summer ? "on" : "",
  };
}

// Calendar-date helpers. All dates are 'YYYY-MM-DD' strings, compared and diffed in UTC so results
// never depend on the server's timezone. "Today" is defined in America/New_York (our launch region).

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: string): boolean {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function toUtcMs(s: string): number {
  if (!isIsoDate(s)) throw new Error(`Invalid ISO date: ${s}`);
  const m = ISO_DATE.exec(s)!;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

/** Whole days from a to b (positive if b is after a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

/** Completed years of age on a given date. */
export function ageOn(birthDate: string, on: string): number {
  const b = ISO_DATE.exec(birthDate);
  const o = ISO_DATE.exec(on);
  if (!b || !o) throw new Error("Invalid date");
  toUtcMs(birthDate);
  toUtcMs(on);
  let age = +o[1] - +b[1];
  const beforeBirthday = +o[2] < +b[2] || (+o[2] === +b[2] && +o[3] < +b[3]);
  if (beforeBirthday) age -= 1;
  return age;
}

/** Today's date in America/New_York as YYYY-MM-DD. */
export function todayET(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA yields YYYY-MM-DD
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * 86_400_000).toISOString().slice(0, 10);
}

export function formatDate(date: string, opts: { year?: boolean } = { year: true }): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(opts.year === false ? {} : { year: "numeric" }),
  }).format(new Date(toUtcMs(date)));
}

/** Expected graduation year for a grade, given today's date (school year turns over July 1). */
export function expectedGraduationYear(grade: number, today: string): number {
  const year = +today.slice(0, 4);
  const month = +today.slice(5, 7);
  const schoolYearEnd = month >= 7 ? year + 1 : year;
  return schoolYearEnd + (12 - grade);
}

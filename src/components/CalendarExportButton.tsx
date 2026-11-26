"use client";

type CalendarEntry = { id: string; title: string; organization: string; date: string; url: string | null };

const escapeText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

export function CalendarExportButton({ entries }: { entries: CalendarEntry[] }) {
  if (!entries.length) return null;
  const download = () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const events = entries.map((entry) => {
      const end = new Date(`${entry.date}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      const endDate = end.toISOString().slice(0, 10).replaceAll("-", "");
      const description = ["Application deadline", entry.url ? `Official page: ${entry.url}` : ""].filter(Boolean).join("\n");
      return [
        "BEGIN:VEVENT",
        `UID:${entry.id}-deadline@opportunityos`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${entry.date.replaceAll("-", "")}`,
        `DTEND;VALUE=DATE:${endDate}`,
        `SUMMARY:${escapeText(`Deadline: ${entry.title}`)}`,
        `DESCRIPTION:${escapeText(`${entry.organization}\n${description}`)}`,
        "END:VEVENT",
      ].join("\r\n");
    });
    const calendar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OpportunityOS//Student deadlines//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "opportunityos-deadlines.ics";
    link.click();
    URL.revokeObjectURL(url);
  };
  return <button type="button" onClick={download} className="min-h-11 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-ink">Add saved deadlines to calendar</button>;
}

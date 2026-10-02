// Shared class strings. Keeping them in one place keeps the visual language consistent without a component library.
export const btn = {
  base: "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-11",
  primary: "bg-ink text-white hover:bg-black",
  accent: "bg-accent text-white hover:bg-blue-800",
  secondary: "border border-line bg-surface text-ink hover:border-ink",
  ghost: "text-ink hover:bg-black/5",
  danger: "border border-red-300 bg-surface text-red-800 hover:bg-red-50",
};
export const button = (v: keyof Omit<typeof btn, "base"> = "primary") => `${btn.base} ${btn[v]}`;

export const input =
  "block w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-muted/70 focus:border-accent min-h-11";
export const label = "block text-sm font-medium text-ink mb-1.5";
export const hint = "text-sm text-muted mt-1";
export const card = "rounded-2xl border border-line bg-surface";
export const chip =
  "inline-flex items-center rounded-full border border-line bg-surface px-3 py-1.5 text-sm cursor-pointer select-none has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent";

/** «vence hoy» · «vence mañana» · «vence el lunes» (hora de México). */
export function expiresLabel(iso: string, now = new Date()): string {
  const tz = "America/Mexico_City";
  const day = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: tz })).setHours(0, 0, 0, 0);
  const end = new Date(iso);
  const diff = Math.round((day(end) - day(now)) / 86_400_000);
  if (diff <= 0) return "vence hoy";
  if (diff === 1) return "vence mañana";
  // Con día del mes: a 7 días, «el domingo» sería ambiguo si hoy también es domingo.
  return `vence el ${end.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", timeZone: tz })}`;
}

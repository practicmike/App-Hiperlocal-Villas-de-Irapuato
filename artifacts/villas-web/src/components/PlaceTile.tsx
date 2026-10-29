import { categoryIcon } from "@/lib/icons";

/**
 * Cuadro de un lugar en las listas: su foto si tiene; si no, el ícono del giro
 * (🍕, 🔧, 🏫…) sobre el color de su categoría, para reconocerlo sin leer.
 */
export function PlaceTile({
  color,
  category,
  name,
  coverUrl,
  size = 44,
}: {
  color: string;
  category: string;
  name: string;
  coverUrl?: string | null;
  size?: number;
}) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (coverUrl) {
    return (
      <img
        src={`${base}${coverUrl}`}
        alt=""
        className="shrink-0 rounded-xl object-cover"
        style={{ width: size, height: size, boxShadow: `0 0 0 2px ${color}` }}
      />
    );
  }
  const icon = categoryIcon(category, name);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-xl"
      style={{ width: size, height: size, background: `${color}2e`, boxShadow: `inset 0 0 0 2px ${color}` }}
    >
      {icon ? (
        <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{icon}</span>
      ) : (
        <span className="rounded-full" style={{ width: size * 0.28, height: size * 0.28, background: color }} />
      )}
    </span>
  );
}

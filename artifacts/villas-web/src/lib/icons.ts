/** Ícono del giro: se reconoce qué es cada estrella sin tocarla. El orden importa (lo más específico primero). */
const RULES: Array<[RegExp, string]> = [
  [/pizz/i, "🍕"],
  [/taco|taquer/i, "🌮"],
  [/caf[eé]/i, "☕"],
  [/pastel|postre|reposter/i, "🎂"],
  [/tortill/i, "🫓"],
  [/panader|\bpan\b/i, "🥐"],
  [/sushi/i, "🍣"],
  [/hamburgues/i, "🍔"],
  [/comida|cocina|restaur|antojit|lonch|fonda/i, "🍲"],
  [/plom/i, "🔧"],
  [/el[eé]ctric|luz/i, "💡"],
  [/jard[ií]n/i, "🌿"],
  [/clima|minisplit|aire acond/i, "❄️"],
  [/carpint|mueble/i, "🪚"],
  [/limpie/i, "🧽"],
  [/pint|impermeab/i, "🎨"],
  [/herrer|soldad/i, "⚒️"],
  [/cerraj|llave/i, "🔑"],
  [/fumig|plaga/i, "🐜"],
  [/lavander|tintorer/i, "🧺"],
  [/colegio|escuela|kinder|primaria/i, "🏫"],
  [/ingl[eé]s|idioma/i, "🔤"],
  [/regulariz|tarea|matem/i, "📐"],
  [/m[uú]sica|piano|guitarr|canto/i, "🎹"],
  [/guarder|estancia/i, "🧸"],
  [/farmac/i, "💊"],
  [/veterin|mascota|est[eé]tica canina/i, "🐾"],
  [/dent/i, "🦷"],
  [/fisio|rehabil/i, "💪"],
  [/m[eé]dic|doctor|consult/i, "🩺"],
  [/casa|depa|terreno|renta|venta|inmueb/i, "🏠"],
  [/auto|mec[aá]nic|taller/i, "🚗"],
  [/belleza|est[eé]tica|u[ñn]as|barber/i, "💇"],
  [/gimnas|yoga|entren/i, "🏋️"],
];

export function categoryIcon(category: string, name = ""): string | null {
  const text = `${category} ${name}`;
  for (const [re, icon] of RULES) if (re.test(text)) return icon;
  return null;
}

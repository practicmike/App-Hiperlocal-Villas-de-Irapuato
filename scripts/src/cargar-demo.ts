/**
 * Carga estrellas de ejemplo para ver el universo antes de tener la lista de
 * comercios fundadores. Son ficticias y su WhatsApp no es real.
 * Solo corre si la tabla de lugares está vacía.
 *
 *   pnpm --filter @workspace/scripts run cargar-demo
 */
import { sql } from "drizzle-orm";
import { db, pool, placesTable, type NewPlace } from "@workspace/db";

const FAKE = "5200000000000";

const raw: Array<Omit<NewPlace, "whatsapp">> = [
  // Gente de confianza (modelo de oficios de Villas-Services)
  { constellation: "resolver", name: "Plomería Don Beto", category: "Plomería", contactName: "Beto", description: "Fugas, calentadores, tinacos y bombas. Llega el mismo día." },
  { constellation: "resolver", name: "Electricidad Hernández", category: "Electricidad", contactName: "José Luis", description: "Instalaciones, cortos, centros de carga y contactos." },
  { constellation: "resolver", name: "Jardines Verdes", category: "Jardinería", contactName: "Ana", description: "Corte de pasto, poda y mantenimiento semanal de jardines." },
  { constellation: "resolver", name: "Climas del Bajío", category: "Clima y minisplit", contactName: "Carlos", description: "Instalación y limpieza de minisplits antes del calor." },
  { constellation: "resolver", name: "Carpintería Luna", category: "Carpintería", contactName: "Roberto", description: "Closets, cocinas integrales y reparación de puertas." },
  { constellation: "resolver", name: "Limpieza Express", category: "Limpieza", description: "Limpieza profunda de casas, fin de obra y vidrios." },
  { constellation: "resolver", name: "Pinturas Torres", category: "Pintura", contactName: "Fer", description: "Pintura interior y exterior, impermeabilización." },
  // Comercios
  { constellation: "antojos", name: "Taquería La Privada", category: "Tacos", description: "Tacos al pastor y de bistec, servicio a domicilio dentro de Villas por la noche." },
  { constellation: "antojos", name: "Pizzas del Parque", category: "Pizzería", description: "Pizza artesanal a domicilio, jueves a domingo." },
  { constellation: "antojos", name: "Café Andador", category: "Cafetería", description: "Desayunos, café de especialidad y pan dulce." },
  { constellation: "aprender", name: "Colegio Montessori Villas", category: "Colegio", description: "Kinder y primaria con método Montessori, cerca de la entrada principal." },
  { constellation: "cuidar", name: "Veterinaria Patitas", category: "Veterinaria", description: "Consultas, vacunas y estética para mascotas." },
  { constellation: "antojos", name: "Pastelería Doña Lupe", category: "Pastelería", description: "Pasteles por encargo y postres para fiestas." },
  // Casas (solo verificadas por el creador)
  { constellation: "hogar", name: "Casa en Privada Encino", category: "Casa en venta", operation: "venta", priceLabel: "$3.2 M", zone: "Privada Encino", description: "Tres recámaras, dos baños y medio, jardín, a dos calles del colegio." },
  { constellation: "hogar", name: "Casa en Privada Fresno", category: "Casa en renta", operation: "renta", priceLabel: "$14,500 / mes", zone: "Privada Fresno", description: "Dos recámaras, cochera para dos autos, cerca de la caseta." },
  { constellation: "hogar", name: "Casa con roof garden", category: "Casa en venta", operation: "venta", priceLabel: "$4.1 M", zone: "Sección Norte", description: "Cuatro recámaras, roof garden y estudio. Lista para habitar." },
];
const demo: NewPlace[] = raw.map((p) => ({ whatsapp: FAKE, verified: true, active: true, ...p }));

const [{ n }] = (await db.execute(sql`select count(*)::int as n from places`)).rows as Array<{ n: number }>;
if (n > 0) {
  console.log(`Ya hay ${n} lugares; no cargo demo.`);
} else {
  await db.insert(placesTable).values(demo);
  console.log(`Listo: ${demo.length} estrellas demo. Edítalas o desactívalas desde el panel.`);
  console.log("Si hay OPENAI_API_KEY, edita y guarda cada una para calcular su embedding.");
}
await pool.end();

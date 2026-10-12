import type { NewPlace } from "@workspace/db";

/**
 * Estrellas de ejemplo para probar el sistema: 10 por constelación.
 * Son ficticias. Su WhatsApp usa el rango 52 000 000 00XX, que no pertenece a nadie:
 * así ninguna prueba le escribe a una persona real y se pueden borrar todas juntas.
 */
export const DEMO_WHATSAPP_PREFIX = "5200000000";

const wa = (n: number) => `${DEMO_WHATSAPP_PREFIX}${String(n).padStart(2, "0")}`;

type Seed = Omit<NewPlace, "whatsapp" | "verified" | "active">;

const SEEDS: Seed[] = [
  // ------------------------------------------------ Gente de confianza (oficios)
  { constellation: "confianza", name: "Plomería Don Beto", category: "Plomería", contactName: "Roberto", description: "Fugas, tinacos, calentadores y bombas. Llega el mismo día si es urgente." },
  { constellation: "confianza", name: "Electricidad Hernández", category: "Electricidad", contactName: "José Luis", description: "Cortos, contactos, centros de carga y lámparas. Revisión de recibos altos." },
  { constellation: "confianza", name: "Jardines Verdes", category: "Jardinería", contactName: "Ana", description: "Corte de pasto, poda de árboles y mantenimiento semanal de jardines." },
  { constellation: "confianza", name: "Climas del Bajío", category: "Clima y minisplit", contactName: "Carlos", description: "Instalación, carga de gas y limpieza de minisplits antes del calor." },
  { constellation: "confianza", name: "Carpintería Luna", category: "Carpintería", contactName: "Martín", description: "Closets, cocinas integrales, puertas que rozan y reparación de muebles." },
  { constellation: "confianza", name: "Limpieza Express", category: "Limpieza", contactName: "Lupita", description: "Limpieza profunda de casas, fin de obra, vidrios y salas." },
  { constellation: "confianza", name: "Pinturas Torres", category: "Pintura e impermeabilización", contactName: "Fernando", description: "Pintura interior y exterior. Impermeabilización antes de lluvias." },
  { constellation: "confianza", name: "Herrería El Yunque", category: "Herrería", contactName: "Don Chuy", description: "Protecciones, portones, barandales y reparación de soldaduras." },
  { constellation: "confianza", name: "Cerrajería 24 h", category: "Cerrajería", contactName: "Iván", description: "Apertura de puertas y autos, cambio de chapas y duplicado de llaves." },
  { constellation: "confianza", name: "Fumigaciones Sanas", category: "Fumigación", contactName: "Paty", description: "Control de cucarachas, hormigas, alacranes y termitas. Seguro para mascotas." },

  // ------------------------------------------------------------------ Comercios
  { constellation: "comercios", name: "Taquería La Privada", category: "Tacos", contactName: "Toño", description: "Pastor, bistec y suadero. Servicio a domicilio dentro de Villas por las noches." },
  { constellation: "comercios", name: "Pizzas del Parque", category: "Pizzería", contactName: "Gaby", description: "Pizza artesanal a domicilio de jueves a domingo. Promoción familiar." },
  { constellation: "comercios", name: "Café Andador", category: "Cafetería", contactName: "Sofía", description: "Desayunos, café de especialidad, pan dulce y espacio para trabajar." },
  { constellation: "comercios", name: "Colegio Montessori Villas", category: "Colegio", contactName: "Miss Laura", description: "Kinder y primaria con método Montessori, cerca de la entrada principal." },
  { constellation: "comercios", name: "Veterinaria Patitas", category: "Veterinaria", contactName: "Dr. Ramírez", description: "Consultas, vacunas, estética y urgencias para perros y gatos." },
  { constellation: "comercios", name: "Pastelería Doña Lupe", category: "Pastelería", contactName: "Lupe", description: "Pasteles por encargo, gelatinas y postres para fiestas infantiles." },
  { constellation: "comercios", name: "Farmacia Villas", category: "Farmacia", contactName: "Mónica", description: "Medicamentos, curaciones y entrega a domicilio en la colonia." },
  { constellation: "comercios", name: "Lavandería Burbujas", category: "Lavandería", contactName: "Rosa", description: "Lavado por kilo, edredones y planchado. Recolección a domicilio." },
  { constellation: "comercios", name: "Tortillería La Güera", category: "Tortillería", contactName: "Elena", description: "Tortillas de maíz recién hechas, totopos y masa por kilo." },
  { constellation: "comercios", name: "Comida Casera Doña Mary", category: "Comida a domicilio", contactName: "Mary", description: "Comida corrida de lunes a viernes: sopa, guisado y agua. Entrega al mediodía." },

  // --------------------------------------------------------------------- Casas
  { constellation: "casas", name: "Casa en Privada Encino", category: "Casa en venta", contactName: "Sr. Gómez", operation: "venta", priceLabel: "$3.2 M", zone: "Privada Encino", description: "Tres recámaras, dos baños y medio, jardín, a dos calles del colegio." },
  { constellation: "casas", name: "Casa en Privada Fresno", category: "Casa en renta", contactName: "Sra. Paredes", operation: "renta", priceLabel: "$14,500 / mes", zone: "Privada Fresno", description: "Dos recámaras, cochera para dos autos, cerca de la caseta." },
  { constellation: "casas", name: "Casa con roof garden", category: "Casa en venta", contactName: "Arq. Villalobos", operation: "venta", priceLabel: "$4.1 M", zone: "Sección Norte", description: "Cuatro recámaras, roof garden y estudio. Lista para habitar." },
  { constellation: "casas", name: "Casa esquina Privada Cedro", category: "Casa en venta", contactName: "Sr. Díaz", operation: "venta", priceLabel: "$3.6 M", zone: "Privada Cedro", description: "Tres recámaras, terreno amplio en esquina, cuarto de servicio." },
  { constellation: "casas", name: "Casa amueblada Privada Olmo", category: "Casa en renta", contactName: "Sra. Ortiz", operation: "renta", priceLabel: "$18,000 / mes", zone: "Privada Olmo", description: "Tres recámaras, amueblada y equipada, ideal para ejecutivos." },
  { constellation: "casas", name: "Casa de un piso Privada Roble", category: "Casa en venta", contactName: "Sr. Mendoza", operation: "venta", priceLabel: "$2.9 M", zone: "Privada Roble", description: "Dos recámaras en planta baja, sin escaleras, ideal para adultos mayores." },
  { constellation: "casas", name: "Casa frente a área verde", category: "Casa en renta", contactName: "Sra. Luna", operation: "renta", priceLabel: "$15,500 / mes", zone: "Privada Sauce", description: "Tres recámaras frente al parque, perfecta para familias con niños." },
  { constellation: "casas", name: "Casa con alberca Sección Sur", category: "Casa en venta", contactName: "Lic. Navarro", operation: "venta", priceLabel: "$5.4 M", zone: "Sección Sur", description: "Cuatro recámaras, alberca, jardín y cochera techada para tres autos." },
  { constellation: "casas", name: "Casa remodelada Privada Pino", category: "Casa en venta", contactName: "Sr. Herrera", operation: "venta", priceLabel: "$3.3 M", zone: "Privada Pino", description: "Tres recámaras, cocina nueva, pisos de porcelanato y paneles solares." },
  { constellation: "casas", name: "Departamento en planta alta", category: "Departamento en renta", contactName: "Sra. Campos", operation: "renta", priceLabel: "$11,000 / mes", zone: "Sección Norte", description: "Dos recámaras, balcón, un cajón de estacionamiento. Mascotas pequeñas permitidas." },
];

export const DEMO_PLACES: NewPlace[] = SEEDS.map((s, i) => ({
  ...s,
  whatsapp: wa(i + 1),
  verified: true,
  active: true,
}));

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
  { constellation: "resolver", name: "Plomería Don Beto", category: "Plomería", contactName: "Roberto", description: "Reparo fugas de agua en baños, cocinas y tuberías; cambio de tinacos, calentadores de gas y bombas presurizadoras. Destapo coladeras y WC. Atiendo urgencias el mismo día dentro de Villas, también fines de semana. Cotización sin costo y garantía de 30 días en mano de obra." },
  { constellation: "resolver", name: "Electricidad Hernández", category: "Electricidad", contactName: "José Luis", description: "Electricista certificado: reviso cortos, apagones parciales, contactos que no funcionan y centros de carga que se botan. Instalo lámparas, ventiladores de techo y contactos para minisplit. Reviso por qué llega alto el recibo de CFE. Visita de diagnóstico en Villas con precio fijo." },
  { constellation: "resolver", name: "Jardines Verdes", category: "Jardinería", contactName: "Ana", description: "Mantenimiento de jardines por semana o quincena: corte de pasto, orilla, poda de arbustos y árboles medianos, fumigación de plantas y retiro de basura verde. También diseño de jardines pequeños, siembra de pasto en rollo y riego por goteo. Trabajo en toda la colonia." },
  { constellation: "resolver", name: "Climas del Bajío", category: "Clima y minisplit", contactName: "Carlos", description: "Instalación de minisplits de todas las marcas, mantenimiento preventivo, limpieza profunda y carga de gas. Reviso equipos que gotean, no enfrían o hacen ruido. Recomiendo agendar en marzo o abril antes del calor. Facturo y doy garantía de instalación." },
  { constellation: "resolver", name: "Carpintería Luna", category: "Carpintería", contactName: "Martín", description: "Hago closets, cocinas integrales, libreros y muebles a la medida en MDF o madera. Reparo puertas que rozan o no cierran, cambio chapas y bisagras, y restauro muebles antiguos. Llevo muestras de acabados a su casa y entrego en 2 a 3 semanas." },
  { constellation: "resolver", name: "Limpieza Express", category: "Limpieza", contactName: "Lupita", description: "Limpieza profunda de casas y departamentos: cocina, baños, vidrios, closets y pisos. Limpieza de fin de obra o mudanza, lavado de salas, colchones y alfombras a domicilio. Equipo de dos personas, llevamos productos. Por evento o servicio semanal." },
  { constellation: "resolver", name: "Pinturas Torres", category: "Pintura e impermeabilización", contactName: "Fernando", description: "Pintura interior y exterior de casas, fachadas y bardas, con resanado previo. Impermeabilización de azoteas con sistema acrílico o prefabricado, ideal antes de lluvias (mayo-junio). Garantía por escrito de 3 a 5 años según el sistema. Presupuesto sin costo." },
  { constellation: "resolver", name: "Herrería El Yunque", category: "Herrería", contactName: "Don Chuy", description: "Fabrico protecciones para ventanas, portones, puertas de acceso, barandales y escaleras de herrería. Reparo soldaduras, bisagras de portón y motores de puerta automática. Pintura anticorrosiva incluida. Tomo medidas a domicilio en Villas." },
  { constellation: "resolver", name: "Cerrajería 24 h", category: "Cerrajería", contactName: "Iván", description: "Abro puertas de casa y autos cuando dejas las llaves dentro, a cualquier hora. Cambio y reparo chapas, cerraduras de seguridad y cilindros; duplico llaves de casa y llaves con chip de auto. Llego en 30 minutos dentro de Villas." },
  { constellation: "resolver", name: "Fumigaciones Sanas", category: "Fumigación", contactName: "Paty", description: "Control de cucarachas, hormigas, alacranes, arañas, chinches y termitas en casas y jardines. Productos seguros para niños y mascotas, con certificado. Servicio preventivo cada 3 meses o atención de plagas activas. Garantía de 60 días." },

  // ------------------------------------------------------------------ Comercios
  { constellation: "antojos", name: "Taquería La Privada", welcomeOffer: "Orden de tacos de cortesía en tu primer pedido", category: "Tacos", contactName: "Toño", description: "Tacos de pastor, bistec, suadero y campechanos, con salsas de la casa, cebollitas y nopales. Abrimos de jueves a domingo de 7 pm a 12 am. Servicio a domicilio sin costo dentro de Villas a partir de 10 tacos. Pedidos por WhatsApp." },
  { constellation: "antojos", name: "Pizzas del Parque", welcomeOffer: "Refresco de 2 L gratis en tu primera pizza", category: "Pizzería", contactName: "Gaby", description: "Pizza artesanal en horno de piedra, masa madre de 48 horas: pepperoni, hawaiana, mexicana y opciones vegetarianas. Entregamos a domicilio en Villas de jueves a domingo de 6 a 11 pm. Promoción familiar los jueves: dos pizzas grandes y refresco." },
  { constellation: "antojos", name: "Café Andador", welcomeOffer: "Primer café 2x1", category: "Cafetería", contactName: "Sofía", description: "Cafetería con desayunos de 8 a 1 (chilaquiles, molletes, avena, hot cakes), café de especialidad de Veracruz y Chiapas, pan dulce del día y opciones sin gluten. Wifi y mesas para trabajar. También pedidos para llevar y café por kilo." },
  { constellation: "aprender", name: "Colegio Montessori Villas", category: "Colegio", contactName: "Miss Laura", description: "Kinder y primaria con método Montessori, grupos pequeños de máximo 18 niños, inglés diario y talleres de arte y huerto. Horario de 8 a 2 con estancia hasta las 5. A cinco minutos caminando de la entrada principal. Inscripciones abiertas, visitas con cita." },
  { constellation: "cuidar", name: "Veterinaria Patitas", welcomeOffer: "Baño gratis en la primera consulta", category: "Veterinaria", contactName: "Dr. Ramírez", description: "Consulta para perros y gatos, vacunas, desparasitación, esterilización y cirugías menores. Estética canina con baño, corte y uñas. Atendemos urgencias por WhatsApp y hacemos consultas a domicilio en Villas. Venta de alimento premium." },
  { constellation: "antojos", name: "Pastelería Doña Lupe", welcomeOffer: "10% en tu primer pastel", category: "Pastelería", contactName: "Lupe", description: "Pasteles por encargo para cumpleaños, bautizos y XV años: tres leches, chocolate, zanahoria y fondant temático. Gelatinas, cupcakes y mesas de postres para fiestas infantiles. Pide con 3 días de anticipación; entrega a domicilio en Villas." },
  { constellation: "cuidar", name: "Farmacia Villas", welcomeOffer: "Toma de glucosa gratis y 10% en tu primera compra", category: "Farmacia", contactName: "Mónica", description: "Medicamentos de patente y genéricos, material de curación, pañales y artículos de higiene. Entrega a domicilio en Villas en menos de una hora, de 8 am a 10 pm todos los días. Toma de presión y glucosa sin costo. Recibimos recetas por WhatsApp." },
  { constellation: "resolver", name: "Lavandería Burbujas", welcomeOffer: "Primer kilo gratis", category: "Lavandería", contactName: "Rosa", description: "Lavado por kilo con secado y doblado, lavado de edredones, cobijas y cortinas, tintorería y planchado por pieza. Recolección y entrega a domicilio en Villas martes y viernes. Ropa lista en 24 horas." },
  { constellation: "antojos", name: "Tortillería La Güera", welcomeOffer: "Medio kilo de totopos de regalo", category: "Tortillería", contactName: "Elena", description: "Tortillas de maíz nixtamalizado recién hechas, masa por kilo para tamales y gorditas, totopos y tostadas caseras. Abrimos de 7 am a 3 pm. Apartamos por WhatsApp y llevamos pedidos grandes para fiestas." },
  { constellation: "antojos", name: "Comida Casera Doña Mary", category: "Comida a domicilio", contactName: "Mary", description: "Comida corrida casera de lunes a viernes: sopa o arroz, guisado del día (mole, pollo en salsa verde, chiles rellenos), tortillas y agua fresca. Entrega a domicilio en Villas al mediodía. Menú semanal por WhatsApp y paquetes para oficina." },

  // --------------------------------------------------------------------- Casas
  { constellation: "hogar", name: "Casa en Privada Encino", category: "Casa en venta", contactName: "Sr. Gómez", operation: "venta", priceLabel: "$3.2 M", zone: "Privada Encino", description: "Casa de dos plantas en privada con vigilancia: tres recámaras, la principal con vestidor y baño, dos baños y medio, sala-comedor, cocina integral, jardín trasero y cochera para dos autos. A dos calles del colegio y del parque. Acepta crédito Infonavit y bancario." },
  { constellation: "hogar", name: "Casa en Privada Fresno", category: "Casa en renta", contactName: "Sra. Paredes", operation: "renta", priceLabel: "$14,500 / mes", zone: "Privada Fresno", description: "Casa en renta de dos recámaras y un baño y medio, cochera para dos autos, patio de servicio y cocina equipada. Cerca de la caseta de entrada. Se pide un mes de depósito y aval o póliza jurídica. Disponible de inmediato; no amueblada." },
  { constellation: "hogar", name: "Casa con roof garden", category: "Casa en venta", contactName: "Arq. Villalobos", operation: "venta", priceLabel: "$4.1 M", zone: "Sección Norte", description: "Casa de tres niveles: cuatro recámaras, estudio, tres baños completos, roof garden con asador y vista al cerro, cocina abierta con isla. Acabados nuevos y lista para habitar. Sección Norte, cerca de la salida a la carretera." },
  { constellation: "hogar", name: "Casa esquina Privada Cedro", category: "Casa en venta", contactName: "Sr. Díaz", operation: "venta", priceLabel: "$3.6 M", zone: "Privada Cedro", description: "Casa en esquina con terreno amplio de 200 m², tres recámaras, cuarto de servicio con baño, jardín lateral y espacio para ampliar. Mucha luz natural. Escrituras en regla, se acepta crédito." },
  { constellation: "hogar", name: "Casa amueblada Privada Olmo", category: "Casa en renta", contactName: "Sra. Ortiz", operation: "renta", priceLabel: "$18,000 / mes", zone: "Privada Olmo", description: "Casa en renta totalmente amueblada y equipada: tres recámaras con camas, cocina con electrodomésticos, lavadora, internet y minisplit en recámara principal. Ideal para ejecutivos o estancias de 6 a 12 meses. Incluye mantenimiento de jardín." },
  { constellation: "hogar", name: "Casa de un piso Privada Roble", category: "Casa en venta", contactName: "Sr. Mendoza", operation: "venta", priceLabel: "$2.9 M", zone: "Privada Roble", description: "Casa de una sola planta, sin escaleras: dos recámaras, un baño completo con regadera accesible, sala-comedor y patio. Ideal para adultos mayores o personas con movilidad reducida. Privada tranquila con vigilancia." },
  { constellation: "hogar", name: "Casa frente a área verde", category: "Casa en renta", contactName: "Sra. Luna", operation: "renta", priceLabel: "$15,500 / mes", zone: "Privada Sauce", description: "Casa en renta de tres recámaras frente al parque principal, perfecta para familias con niños: jardín propio, cochera techada, dos baños y medio. Se aceptan mascotas pequeñas. Contrato mínimo de un año." },
  { constellation: "hogar", name: "Casa con alberca Sección Sur", category: "Casa en venta", contactName: "Lic. Navarro", operation: "venta", priceLabel: "$5.4 M", zone: "Sección Sur", description: "Residencia de cuatro recámaras con alberca climatizada, jardín amplio, terraza techada, cuarto de juegos y cochera techada para tres autos. Paneles solares y cisterna de 10 mil litros. Sección Sur, la más tranquila de Villas." },
  { constellation: "hogar", name: "Casa remodelada Privada Pino", category: "Casa en venta", contactName: "Sr. Herrera", operation: "venta", priceLabel: "$3.3 M", zone: "Privada Pino", description: "Casa remodelada en 2025: tres recámaras, cocina nueva con cuarzo, pisos de porcelanato, baños renovados y paneles solares que bajan el recibo de luz casi a cero. Lista para escriturar." },
  { constellation: "hogar", name: "Departamento en planta alta", category: "Departamento en renta", contactName: "Sra. Campos", operation: "renta", priceLabel: "$11,000 / mes", zone: "Sección Norte", description: "Departamento en renta en planta alta: dos recámaras, un baño, balcón, cocina integral y un cajón de estacionamiento. Se permiten mascotas pequeñas. Agua incluida en la renta." },

  // ------------------------------------------------------------- Aprender (más)
  { constellation: "aprender", name: "Inglés para niños Kids Club", welcomeOffer: "Primera semana gratis", category: "Clases de inglés", contactName: "Teacher Ana", description: "Clases de inglés para niños de 4 a 12 años en grupos de máximo 6, por las tardes de lunes a jueves. Método con juegos y canciones, preparación para exámenes Cambridge. Primera clase de prueba gratis; también clases particulares a domicilio en Villas." },
  { constellation: "aprender", name: "Regularización Profe Jorge", category: "Regularización escolar", contactName: "Profe Jorge", description: "Regularización de matemáticas, física y química para secundaria y prepa. Apoyo con tareas, preparación para exámenes extraordinarios y examen de admisión a la universidad. Sesiones individuales o en pareja, en mi casa o en línea." },
  { constellation: "aprender", name: "Piano y guitarra Do Re Mi", category: "Clases de música", contactName: "Maestra Carmen", description: "Clases de piano, guitarra y canto para niños y adultos, desde cero. Clases de 45 minutos, una o dos veces por semana. Presentación de fin de curso. Tengo instrumentos para practicar en clase." },
  { constellation: "aprender", name: "Guardería Pequeños Pasos", category: "Guardería", contactName: "Lic. Rocío", description: "Guardería para niños de 6 meses a 4 años, de 7 am a 6 pm. Alimentación incluida, estimulación temprana, cámaras para papás y personal con primeros auxilios. Dentro de Villas, a una calle de la caseta." },

  // --------------------------------------------------------------- Cuidar (más)
  { constellation: "cuidar", name: "Consultorio Dra. Salazar", category: "Médico general", contactName: "Dra. Salazar", description: "Médico general y familiar: consulta para niños y adultos, control de presión, diabetes y certificados médicos. También consultas a domicilio en Villas para adultos mayores. Lunes a sábado con cita por WhatsApp." },
  { constellation: "cuidar", name: "Dental Sonrisa", category: "Dentista", contactName: "Dr. Medina", description: "Limpieza dental, resinas, extracciones, endodoncia y ortodoncia para niños y adultos. Atendemos urgencias por dolor el mismo día. Planes de pago sin intereses." },
  { constellation: "cuidar", name: "Fisioterapia en Casa", category: "Fisioterapia", contactName: "Lic. Andrés", description: "Fisioterapia y rehabilitación a domicilio: lesiones deportivas, dolor de espalda, recuperación después de cirugía y terapia para adultos mayores. Llevo camilla y equipo. Sesiones de una hora." },
];

// ----------------------------------------------- datos de ficha completa
type DayH = { open: string; close: string } | null;
/** dom, lun…sáb */
const week = (weekday: DayH, sat: DayH = weekday, sun: DayH = null): DayH[] => [sun, weekday, weekday, weekday, weekday, weekday, sat];
const h = (open: string, close: string) => ({ open, close });
const thuSun = (o: string, c: string): DayH[] => [h(o, c), null, null, null, h(o, c), h(o, c), h(o, c)];

const EXTRA: Record<string, Partial<NewPlace>> = {
  // Oficios: van a tu casa.
  "Plomería Don Beto": { kind: "oficio", delivers: true, priceLabel: "Visita desde $300", hours: week(h("08:00", "19:00"), h("09:00", "15:00"), h("10:00", "14:00")) },
  "Electricidad Hernández": { kind: "oficio", delivers: true, priceLabel: "Diagnóstico $350", hours: week(h("09:00", "18:00"), h("09:00", "14:00")) },
  "Jardines Verdes": { kind: "oficio", delivers: true, priceLabel: "Desde $450 por visita", hours: week(h("08:00", "16:00"), h("08:00", "13:00")) },
  "Climas del Bajío": { kind: "oficio", delivers: true, priceLabel: "Mantenimiento $650", hours: week(h("09:00", "18:00"), h("09:00", "14:00")) },
  "Carpintería Luna": { kind: "oficio", delivers: true, hours: week(h("09:00", "18:00"), h("09:00", "13:00")) },
  "Limpieza Express": { kind: "oficio", delivers: true, priceLabel: "Desde $900 por casa", hours: week(h("08:00", "17:00"), h("08:00", "14:00")) },
  "Pinturas Torres": { kind: "oficio", delivers: true, hours: week(h("08:00", "18:00"), h("08:00", "14:00")) },
  "Herrería El Yunque": { kind: "oficio", delivers: true, hours: week(h("09:00", "18:00"), h("09:00", "14:00")) },
  "Cerrajería 24 h": { kind: "oficio", delivers: true, priceLabel: "Apertura desde $350", hours: [h("00:00", "24:00"), h("00:00", "24:00"), h("00:00", "24:00"), h("00:00", "24:00"), h("00:00", "24:00"), h("00:00", "24:00"), h("00:00", "24:00")] },
  "Fumigaciones Sanas": { kind: "oficio", delivers: true, priceLabel: "Desde $700", hours: week(h("09:00", "18:00"), h("09:00", "14:00")) },
  "Fisioterapia en Casa": { kind: "oficio", delivers: true, priceLabel: "Sesión $500", hours: week(h("08:00", "20:00"), h("09:00", "14:00")) },
  "Regularización Profe Jorge": { kind: "oficio", priceLabel: "$250 la hora", hours: week(h("16:00", "20:00"), h("10:00", "14:00")) },
  "Piano y guitarra Do Re Mi": { kind: "oficio", priceLabel: "$1,200 al mes", hours: week(h("15:00", "20:00"), h("10:00", "13:00")) },
  // Comercios: tú vas (algunos también entregan).
  "Lavandería Burbujas": { pickup: true, delivers: true, priceLabel: "$28 el kilo", hours: week(h("08:00", "20:00"), h("08:00", "15:00")) },
  "Taquería La Privada": { pickup: true, delivers: true, priceLabel: "Taco $22", hours: thuSun("19:00", "24:00") },
  "Pizzas del Parque": { pickup: true, delivers: true, priceLabel: "Grande desde $189", hours: thuSun("18:00", "23:00") },
  "Café Andador": { pickup: true, priceLabel: "Desayuno desde $95", hours: week(h("08:00", "13:00"), h("08:00", "14:00"), h("09:00", "14:00")) },
  "Pastelería Doña Lupe": { pickup: true, delivers: true, priceLabel: "Pastel desde $380", hours: week(h("10:00", "19:00"), h("10:00", "17:00")) },
  "Tortillería La Güera": { pickup: true, priceLabel: "$24 el kilo", hours: week(h("07:00", "15:00"), h("07:00", "15:00"), h("07:00", "13:00")) },
  "Comida Casera Doña Mary": { pickup: true, delivers: true, priceLabel: "Comida corrida $110", hours: week(h("12:00", "16:00"), null) },
  "Farmacia Villas": { pickup: true, delivers: true, hours: week(h("08:00", "22:00"), h("08:00", "22:00"), h("08:00", "22:00")) },
  "Veterinaria Patitas": { delivers: true, priceLabel: "Consulta $350", hours: week(h("09:00", "19:00"), h("09:00", "15:00")) },
  "Consultorio Dra. Salazar": { delivers: true, priceLabel: "Consulta $450", hours: week(h("09:00", "19:00"), h("09:00", "14:00")) },
  "Dental Sonrisa": { priceLabel: "Limpieza $600", hours: week(h("10:00", "19:00"), h("10:00", "14:00")) },
  "Colegio Montessori Villas": { priceLabel: "Colegiatura desde $4,800", hours: week(h("08:00", "17:00"), null) },
  "Inglés para niños Kids Club": { priceLabel: "$1,400 al mes", hours: week(h("15:00", "19:00"), null) },
  "Guardería Pequeños Pasos": { priceLabel: "$3,900 al mes", hours: week(h("07:00", "18:00"), null) },
  // Casas: datos para que el match sea preciso.
  "Casa en Privada Encino": { bedrooms: 3, bathrooms: 2.5, parking: 2, landM2: 160, builtM2: 180 },
  "Casa en Privada Fresno": { bedrooms: 2, bathrooms: 1.5, parking: 2, landM2: 120, builtM2: 110 },
  "Casa con roof garden": { bedrooms: 4, bathrooms: 3, parking: 2, landM2: 180, builtM2: 260 },
  "Casa esquina Privada Cedro": { bedrooms: 3, bathrooms: 2, parking: 2, landM2: 200, builtM2: 170 },
  "Casa amueblada Privada Olmo": { bedrooms: 3, bathrooms: 2, parking: 2, landM2: 140, builtM2: 160 },
  "Casa de un piso Privada Roble": { bedrooms: 2, bathrooms: 1, parking: 1, landM2: 150, builtM2: 95 },
  "Casa frente a área verde": { bedrooms: 3, bathrooms: 2.5, parking: 2, landM2: 150, builtM2: 170 },
  "Casa con alberca Sección Sur": { bedrooms: 4, bathrooms: 4, parking: 3, landM2: 400, builtM2: 380 },
  "Casa remodelada Privada Pino": { bedrooms: 3, bathrooms: 2, parking: 2, landM2: 160, builtM2: 175 },
  "Departamento en planta alta": { bedrooms: 2, bathrooms: 1, parking: 1, builtM2: 75 },
};

/**
 * Centro aproximado de Irapuato: solo sirve para que el radar de prueba tenga
 * algo que mostrar. Las ubicaciones reales se capturan en el panel, en el local.
 */
const DEMO_CENTER = { lat: 20.6767, lng: -101.3563 };

/** Ubicación ficticia y estable (misma cada vez que se recargan los ejemplos), a 80–750 m del centro. */
function demoCoords(i: number) {
  const angle = i * 2.399963; // ángulo áureo: reparte los puntos sin encimarlos
  const meters = 80 + ((i * 97) % 670);
  return {
    lat: Math.round((DEMO_CENTER.lat + (meters * Math.cos(angle)) / 111_320) * 1e6) / 1e6,
    lng: Math.round((DEMO_CENTER.lng + (meters * Math.sin(angle)) / 104_100) * 1e6) / 1e6,
  };
}

export const DEMO_PLACES: NewPlace[] = SEEDS.map((s, i) => {
  const place = {
    kind: "comercio" as const,
    delivers: false,
    pickup: false,
    hours: null,
    ...s,
    ...EXTRA[s.name],
  };
  // Los oficios van a tu casa: sin local, sin punto en el radar.
  const coords = place.kind === "oficio" ? { lat: null, lng: null } : demoCoords(i);
  return { ...place, ...coords, whatsapp: wa(i + 1), verified: true, active: true };
});

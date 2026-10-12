import type { Constellation } from "@workspace/api-client-react";

export const CONSTELLATIONS: Record<
  Constellation,
  { label: string; color: string; angle: number; hint: string }
> = {
  casas: { label: "Casas", color: "#e6c882", angle: -90, hint: "Venta y renta en Villas" },
  confianza: {
    label: "Gente de confianza",
    color: "#50e3c2",
    angle: 45,
    hint: "Oficios recomendados",
  },
  comercios: { label: "Comercios", color: "#e38fc1", angle: 135, hint: "Comida, colegios y más" },
};

export const ORDER: Constellation[] = ["casas", "confianza", "comercios"];

/** Link de WhatsApp con mensaje inicial; deja claro de dónde viene el contacto. */
export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** Fotos desde el celular: se reducen antes de subir (rápido con datos móviles). */
/** Reduce la foto en el propio celular: máx. 1600 px, WebP (o JPG si el navegador no sabe WebP). */
export async function shrinkPhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file).catch(async () => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    return img;
  });
  const w0 = "width" in bitmap ? bitmap.width : 0;
  const h0 = "height" in bitmap ? bitmap.height : 0;
  const scale = Math.min(1, 1600 / Math.max(w0, h0));
  const width = Math.round(w0 * scale);
  const height = Math.round(h0 * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  let blob = await toBlob("image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.85);
  if (!blob) throw new Error("No pude procesar la foto.");
  return { blob, width, height };
}


/** Sube la foto ya reducida como binario; devuelve el JSON de respuesta. */
export async function uploadPhoto<T = unknown>(path: string, photo: { blob: Blob; width: number; height: number }): Promise<T> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": photo.blob.type, "x-width": String(photo.width), "x-height": String(photo.height) },
    body: photo.blob,
  });
  const data = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok) throw new Error(data?.message ?? "No se pudo subir la foto.");
  return data as T;
}

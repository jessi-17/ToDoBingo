import { type Sticker } from "./sticker-manifest";

/**
 * Bringing the user's own images into the sticker drawer.
 *
 * Two things happen on the way in, and both matter for what comes after.
 *
 * The image is capped at `MAX_EDGE` on its longest side. A sticker is dropped
 * on the page at about 110 artboard units and exports at a couple of hundred
 * pixels, so a 12-megapixel phone photo is carrying two orders of magnitude
 * more data than anything will ever draw — and it is carried through every
 * canvas composite the export does.
 *
 * And it is kept as a data URL, not an object URL. `URL.createObjectURL` is
 * tied to the document: it dies on reload and has to be revoked by hand or it
 * leaks. A data URL is just a string, so an uploaded sticker can be saved
 * alongside everything else the moment this app grows persistence, and it
 * survives being handed to the exporter without any lifetime bookkeeping.
 */
export const MAX_EDGE = 512;

/** Above this, re-encoding is worth it even when no resize is needed. */
const REENCODE_OVER = 400_000;

const readAsDataUrl = (file: Blob) =>
  new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

const probe = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

async function importOne(file: File, id: string): Promise<Sticker | null> {
  if (!file.type.startsWith("image/")) return null;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await probe(objectUrl);
    if (!image?.naturalWidth || !image.naturalHeight) return null;

    const { naturalWidth: w, naturalHeight: h } = image;
    const factor = Math.min(1, MAX_EDGE / Math.max(w, h));

    // Already small: keep the original bytes rather than re-encoding them,
    // which can only lose quality.
    if (factor === 1 && file.size <= REENCODE_OVER) {
      const src = await readAsDataUrl(file);
      return src ? { id, src, w, h } : null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * factor));
    canvas.height = Math.max(1, Math.round(h * factor));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // WebP keeps the alpha these need and is a fraction of PNG's size. A
    // browser without it returns a PNG data URL from the same call, so there is
    // nothing to fall back to by hand.
    return {
      id,
      src: canvas.toDataURL("image/webp", 0.94),
      w: canvas.width,
      h: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Imports a picked file list. Anything that is not a readable image is counted
 * and skipped rather than aborting the batch — one bad file out of ten should
 * not cost the other nine.
 */
export async function importStickers(
  files: FileList | File[],
  nextId: () => string,
) {
  const results = await Promise.all(
    Array.from(files).map((file) => importOne(file, nextId())),
  );
  const stickers = results.filter((sticker): sticker is Sticker => !!sticker);
  return { stickers, skipped: results.length - stickers.length };
}

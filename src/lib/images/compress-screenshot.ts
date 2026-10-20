import "server-only"
import sharp from "sharp"

// Las capturas de chart llegan del add-on como PNG (lossless, ~0,5–2 MB a
// resolución de monitor). WebP q80 mantiene legibles velas, niveles y texto de
// los ejes y suele dejarlas en 60–200 KB.
const MAX_WIDTH = 1920
const WEBP_QUALITY = 80

export type CompressedImage = {
  buffer:   Buffer
  mimeType: "image/webp"
  width:    number
  height:   number
}

export async function compressScreenshot(input: Buffer): Promise<CompressedImage> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toBuffer({ resolveWithObject: true })

  return { buffer: data, mimeType: "image/webp", width: info.width, height: info.height }
}

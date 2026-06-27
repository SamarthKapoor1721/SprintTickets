// Convert a user-selected image File into a small base64 data URL suitable for
// storing inline (team logos, avatars). The image is downscaled to `max` px on
// its longest side and re-encoded to keep the payload tiny.
export async function fileToLogoDataUrl(file: File, max = 256): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Could not read file"))
    reader.readAsDataURL(file)
  })

  // SVGs can't be drawn-and-re-encoded reliably; keep as-is if small enough.
  if (file.type === "image/svg+xml") return dataUrl

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Invalid image"))
    image.src = dataUrl
  })

  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)

  // PNG preserves transparency for logos.
  return canvas.toDataURL("image/png")
}

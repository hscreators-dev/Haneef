import { Router, Request, Response } from "express";

/**
 * Virtual try-on ("live picture") — SCAFFOLD.
 *
 * POST /api/tryon
 * Body: {
 *   selfie:    string  (data URL of the user's photo — required)
 *   garment:   string  (e.g. "Polo T-Shirt" — required)
 *   colour?:   string  (label, e.g. "Forest Green")
 *   colourHex?:string
 *   material?: string  (fabric label)
 *   designUrl?:string  (uploaded design, if any)
 *   notes?:    string  (free-text placement / styling notes)
 *   audience?: string  ("kids" | "men" | "women")
 *   placement?:string  ("Left chest" | "Front centre" | ...)
 * }
 * Returns: { imageUrl } on success, or 503 if no image model is configured.
 *
 * TO ENABLE: set IMAGE_API_URL and IMAGE_API_KEY in backend/.env, then adapt
 * callImageModel() below to your provider's request/response shape.
 */
const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { selfie, garment, colour, material, designUrl, notes, audience, placement } = req.body ?? {};

  if (!selfie)  return res.status(400).json({ error: "A selfie image is required." });
  if (!garment) return res.status(400).json({ error: "Garment details are required." });

  // Not wired to a provider yet — tell the client clearly so it can show a message.
  if (!process.env.IMAGE_API_URL || !process.env.IMAGE_API_KEY) {
    return res.status(503).json({
      code:  "TRYON_NOT_CONFIGURED",
      error: "Realistic try-on isn't switched on yet. Add IMAGE_API_URL and IMAGE_API_KEY to backend/.env to enable it.",
    });
  }

  const prompt = buildPrompt({ garment, colour, material, notes, audience, placement });

  try {
    const imageUrl = await callImageModel(prompt, selfie, designUrl);
    if (!imageUrl) throw new Error("provider returned no image");
    return res.json({ imageUrl });
  } catch (err) {
    console.error("try-on generation failed:", err);
    return res.status(502).json({ error: "Try-on generation failed. Please try again." });
  }
});

function buildPrompt(o: { garment: string; colour?: string; material?: string; notes?: string; audience?: string; placement?: string }): string {
  const who = o.audience === "kids" ? "child" : o.audience === "women" ? "woman" : o.audience === "men" ? "man" : "person";
  return [
    `Photorealistic photo of the same ${who} from the uploaded photo,`,
    `wearing a ${o.colour ?? ""} ${o.garment}`.replace(/\s+/g, " ").trim() + ",",
    o.material ? `made of ${o.material},` : "",
    o.placement ? `with the supplied design on the ${o.placement.toLowerCase()},` : "with the supplied design on the front,",
    o.notes ? `Extra notes: ${o.notes}.` : "",
    "Keep the person's face, body and pose unchanged. Even studio lighting, clean background.",
  ].filter(Boolean).join(" ");
}

/**
 * Adapt this to your image / virtual-try-on provider.
 * Most image-edit APIs accept a prompt + one or more reference images (the selfie,
 * and optionally the design) and return an image URL or base64 string.
 * This generic version POSTs JSON and reads a URL from common response shapes.
 */
async function callImageModel(prompt: string, selfie: string, designUrl?: string): Promise<string | undefined> {
  const res = await fetch(process.env.IMAGE_API_URL as string, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.IMAGE_API_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      image: selfie,                       // the user's selfie (data URL)
      ...(designUrl ? { design: designUrl } : {}),
    }),
  });
  if (!res.ok) throw new Error(`image API HTTP ${res.status}`);
  const data: any = await res.json();
  // Try a few common shapes — adjust to your provider:
  return data.imageUrl ?? data.url ?? data.output?.[0] ?? data.data?.[0]?.url;
}

export default router;

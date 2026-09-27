// /api/gerar-ia.js
// Gera UMA foto usando a API de imagens da OpenAI (gpt-image-1), seguindo
// as regras do "Guia Mestre — Moodboards Rachel Patrocínio": fotografia
// editorial realista, sem pessoas, carga visual leve, paleta dessaturada
// quente, luz natural suave, sem aparência de IA.
//
// ESSA É A ÚNICA PARTE DO SISTEMA QUE TEM CUSTO — cada chamada gera uma
// imagem paga na conta da OpenAI. O front-end SEMPRE pergunta antes de
// chamar essa rota; ela não confirma nada sozinha (é só uma função, não
// sabe se o clique já foi confirmado ou não), então nunca a chame de outro
// lugar sem essa confirmação antes.
//
// Configure OPENAI_API_KEY nas variáveis de ambiente do projeto Vercel.

// --- Regras do Guia Mestre, traduzidas pra um prompt-base em inglês -------
// (gpt-image-1 segue instruções em inglês de forma mais confiável)

const STYLE_BASE = `Photorealistic editorial reference photograph for a contemporary establishment, fair, event, or activation.

The image must look like a real photograph captured on location with a conventional high-quality camera or mirrorless camera: plausible photographic perspective, realistic lens behavior, authentic depth of field, natural microcontrast, subtle photographic texture and slight real-world imperfections.

Soft, diffused natural daylight or realistic warm ambient light, balanced exposure, subtle shadows, no dramatic sunbeams, no harsh shadows, moderate contrast.

No people, no hands, no faces, no human figures of any kind.

Keep the visual load light and curated: simple background, few objects, clean surfaces, intentional negative space, minimal composition. The image should communicate an idea or a possible visual component of the theme, not a crowded or overly detailed scene.

Editorial, contemporary, refined, documentary, natural and understated — never look like a rendered illustration, 3D render, CGI, digital painting, generic stock photo, or AI-generated image. Allow small natural imperfections: slight asymmetry, natural framing, avoid perfect symmetry or catalog-like staging.`;

const PALETTE_PARAGRAPH = `Use a cohesive, sophisticated, slightly desaturated warm color palette (white, rosé, beige, taupe and deep brown tones), appropriate to the theme. Consistent temperature, saturation and contrast across the image — no neon, no oversaturation, no advertising-style contrast.`;

const NEGATIVE_PARAGRAPH = `No text, no letters, no numbers, no captions, no logos, no watermark, no graphic overlays, no fake collage texture, no added border, no drop shadow around the photo itself, no illustration, no 3D render, no artificial glow, no plastic-looking skin, no deformed hands or fingers, no impossible objects, no studio-perfect composition.`;

// como cada "papel" do shot list deve se comportar como foto (mesma lógica
// da seção 10 do guia — 7 papéis de referência), em inglês
const ROLE_PROMPTS = {
  ambiente: `This is the ANCHOR shot of the moodboard: a wide, open establishing view of the environment, storefront, or space related to the theme, showing architecture and overall atmosphere.`,
  produto1: `A close-up photograph of one specific object or product related to the theme, isolated against a simple, clean background.`,
  produto2: `A close-up photograph of a different object or product detail related to the theme, distinct from any other product shot in this set.`,
  produto3: `A close-up photograph of another small object related to the theme, with a simple clean background.`,
  acao: `An object shown mid-use or mid-interaction — for example an open catalog, a product partially removed from its packaging, an open book, or an item displaced from a shelf as if just handled. Absolutely no people, hands, or faces — only the object and the trace of interaction.`,
  textura: `A close-up photograph of a texture, material, fabric, or repeating pattern related to the theme — no full object or scene, just the surface detail.`,
  detalhe: `A close-up photograph of a complementary accessory or characteristic small detail of the theme.`,
  detalhe2: `A close-up photograph of another small, characteristic detail of the theme, different from the other detail shots.`,
  atmosfera: `A photograph capturing the general mood of the space: lighting, architecture, or decorative elements that convey the spatial feeling of the theme, without being a full wide establishing shot.`,
};

function buildPrompt({ tema, elemento, role, instrucao }) {
  const roleHint = ROLE_PROMPTS[role] || ROLE_PROMPTS.detalhe;
  const subject = elemento
    ? `Photograph a single specific subject related to the theme "${tema}": ${elemento}.`
    : `Theme of the reference moodboard: "${tema}".`;
  const extra = instrucao
    ? `Specific direction from the art director for this exact photograph: ${instrucao}.`
    : "";

  return [STYLE_BASE, subject, roleHint, extra, PALETTE_PARAGRAPH, NEGATIVE_PARAGRAPH]
    .filter(Boolean)
    .join("\n\n");
}

export default async function handler(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "OPENAI_API_KEY não configurada. Adicione essa variável de ambiente no projeto Vercel pra usar a geração por IA (veja o README).",
    });
    return;
  }

  const body = req.method === "POST" ? req.body || {} : req.query || {};
  const tema = (body.tema || "").toString().trim();
  const role = (body.role || "detalhe").toString().trim();
  const elemento = (body.elemento || "").toString().trim();
  const instrucao = (body.instrucao || "").toString().trim();

  if (!tema) {
    res.status(400).json({ error: "Envie o tema do moodboard." });
    return;
  }

  const prompt = buildPrompt({ tema, elemento, role, instrucao });

  try {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1536x1024",
        quality: "medium",
        output_format: "jpeg",
        n: 1,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || `Erro ${r.status} na API da OpenAI`;
      res.status(502).json({ error: msg });
      return;
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      res.status(502).json({ error: "A OpenAI não devolveu nenhuma imagem." });
      return;
    }

    res.status(200).json({
      role,
      image: {
        role,
        url: `data:image/jpeg;base64,${b64}`,
        alt: elemento || tema,
        credit: "Gerado com IA (OpenAI)",
        creditUrl: null,
        source: "OpenAI",
        query: elemento || tema,
      },
    });
  } catch (err) {
    res.status(502).json({ error: err.message || "Falha ao gerar imagem com a OpenAI." });
  }
}

// /api/moodboard.js
// Função serverless (Vercel). Não usa nenhuma API de IA — só bancos de
// imagens gratuitos (Unsplash, Pexels e/ou Pixabay). O "shot list" é gerado
// por regras fixas (sem LLM), então não consome tokens de nenhum tipo.
//
// Configure pelo menos uma destas variáveis de ambiente no projeto Vercel:
//   UNSPLASH_ACCESS_KEY  -> grátis em https://unsplash.com/developers
//   PEXELS_API_KEY       -> grátis em https://www.pexels.com/api/
//   PIXABAY_API_KEY      -> grátis em https://pixabay.com/api/docs/
//
// Se mais de uma estiver configurada, tenta na ordem Unsplash -> Pexels ->
// Pixabay, e cai pra próxima quando uma busca não retornar nada bom (isso
// cobre temas que um banco não tem e outro tem).

const SHOT_LIST = [
  { role: "ambiente", suffix: "ambiente interior loja" },
  { role: "produto1", suffix: "produto detalhe close up" },
  { role: "textura", suffix: "textura padrão material" },
  { role: "acao", suffix: "mãos segurando" },
  { role: "detalhe", suffix: "objeto still life" },
  { role: "produto2", suffix: "vitrine display" },
  { role: "atmosfera", suffix: "decoração ambientação" },
];

// mesmas proporções do template de 7 fotos (build_moodboard.py TEMPLATES[7])
const TEMPLATE_7 = [
  { left: 0.0, top: 0.0, width: 0.266, height: 1.0 },
  { left: 0.274, top: 0.0, width: 0.196, height: 0.575 },
  { left: 0.274, top: 0.585, width: 0.196, height: 0.415 },
  { left: 0.478, top: 0.0, width: 0.226, height: 0.675 },
  { left: 0.478, top: 0.685, width: 0.226, height: 0.315 },
  { left: 0.714, top: 0.0, width: 0.286, height: 0.445 },
  { left: 0.714, top: 0.455, width: 0.286, height: 0.545 },
];

// --- Provedores -------------------------------------------------------

async function searchUnsplash(query, page) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "10");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");
  if (page) url.searchParams.set("page", String(page));

  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const pool = data.results;
  if (!pool || !pool.length) return null;

  const pick = pool[Math.floor(Math.random() * Math.min(5, pool.length))];
  // tracking de download exigido pelas diretrizes da Unsplash
  const dl = pick.links?.download_location;
  if (dl) fetch(`${dl}${dl.includes("?") ? "&" : "?"}client_id=${key}`).catch(() => {});

  return {
    url: pick.urls.regular,
    credit: pick.user?.name || "Unsplash",
    creditUrl: pick.links?.html,
    alt: pick.alt_description,
    source: "Unsplash",
  };
}

async function searchPexels(query, page) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "10");
  url.searchParams.set("orientation", "landscape");
  if (page) url.searchParams.set("page", String(page));

  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) return null;
  const data = await res.json();
  const pool = data.photos;
  if (!pool || !pool.length) return null;

  const pick = pool[Math.floor(Math.random() * Math.min(5, pool.length))];

  return {
    url: pick.src?.large || pick.src?.medium,
    credit: pick.photographer || "Pexels",
    creditUrl: pick.url,
    alt: pick.alt,
    source: "Pexels",
  };
}

async function searchPixabay(query, page) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return null;

  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", query);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", "horizontal");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", "20"); // mínimo aceito pela API é 3, mas 20 dá mais variedade
  if (page) url.searchParams.set("page", String(page));

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pool = data.hits;
  if (!pool || !pool.length) return null;

  const pick = pool[Math.floor(Math.random() * Math.min(5, pool.length))];

  return {
    url: pick.largeImageURL || pick.webformatURL,
    credit: pick.user || "Pixabay",
    creditUrl: pick.pageURL,
    alt: query,
    source: "Pixabay",
  };
}

// tenta cada provedor na ordem até um retornar foto
async function searchAny(query, page) {
  const providers = [searchUnsplash, searchPexels, searchPixabay];
  for (const provider of providers) {
    try {
      const result = await provider(query, page);
      if (result) return result;
    } catch (_) {
      // ignora e tenta o próximo provedor
    }
  }
  return null;
}

// --- Handler ------------------------------------------------------------

export default async function handler(req, res) {
  const hasUnsplash = !!process.env.UNSPLASH_ACCESS_KEY;
  const hasPexels = !!process.env.PEXELS_API_KEY;
  const hasPixabay = !!process.env.PIXABAY_API_KEY;

  if (!hasUnsplash && !hasPexels && !hasPixabay) {
    res.status(500).json({
      error:
        "Nenhum banco de imagens configurado. Adicione UNSPLASH_ACCESS_KEY, PEXELS_API_KEY e/ou PIXABAY_API_KEY nas variáveis de ambiente do projeto Vercel (veja o README).",
    });
    return;
  }

  const tema = (req.query.tema || "").toString().trim();
  if (!tema) {
    res.status(400).json({ error: "Envie ?tema=alguma coisa" });
    return;
  }

  const seedPage = Math.max(1, Math.min(3, parseInt(req.query.variacao, 10) || 1));

  try {
    const results = await Promise.all(
      SHOT_LIST.map(async (shot) => {
        const query = `${tema} ${shot.suffix}`;
        let found = await searchAny(query, seedPage);
        if (!found) found = await searchAny(tema, seedPage); // fallback: tema puro
        if (!found) return null;
        return { role: shot.role, ...found };
      })
    );

    const images = results.filter(Boolean);

    res.status(200).json({
      tema,
      template: TEMPLATE_7,
      images,
      fontes: {
        unsplash: hasUnsplash,
        pexels: hasPexels,
        pixabay: hasPixabay,
      },
    });
  } catch (err) {
    res.status(502).json({ error: err.message || "Falha ao buscar fotos" });
  }
}

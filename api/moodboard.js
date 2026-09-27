// /api/moodboard.js
// Função serverless (Vercel). Não usa nenhuma API de IA — só a Unsplash Search
// API (gratuita). O "shot list" é gerado por regras fixas (sem LLM), então
// não consome tokens de nenhum tipo.
//
// Configuração necessária no projeto Vercel:
//   UNSPLASH_ACCESS_KEY  -> crie de graça em https://unsplash.com/developers
//                           (app "Demo", client_id gerado na hora)

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
  { left: 0.0, top: 0.0, width: 0.266, height: 1.0 }, // ambiente (hero)
  { left: 0.274, top: 0.0, width: 0.196, height: 0.575 }, // produto1
  { left: 0.274, top: 0.585, width: 0.196, height: 0.415 }, // textura
  { left: 0.478, top: 0.0, width: 0.226, height: 0.675 }, // acao
  { left: 0.478, top: 0.685, width: 0.226, height: 0.315 }, // detalhe
  { left: 0.714, top: 0.0, width: 0.286, height: 0.445 }, // produto2
  { left: 0.714, top: 0.455, width: 0.286, height: 0.545 }, // atmosfera
];

async function searchUnsplash(query, accessKey, page) {
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "10");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");
  if (page) url.searchParams.set("page", String(page));

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });
  if (!res.ok) {
    throw new Error(`Unsplash respondeu ${res.status} para "${query}"`);
  }
  return res.json();
}

// dispara (sem esperar) o tracking de download exigido pelas diretrizes da
// Unsplash sempre que uma foto é efetivamente usada/exibida
function trackDownload(downloadLocation, accessKey) {
  if (!downloadLocation) return;
  fetch(`${downloadLocation}${downloadLocation.includes("?") ? "&" : "?"}client_id=${accessKey}`).catch(() => {});
}

export default async function handler(req, res) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    res.status(500).json({
      error:
        "UNSPLASH_ACCESS_KEY não configurada. Adicione essa variável de ambiente no projeto Vercel (veja o README).",
    });
    return;
  }

  const tema = (req.query.tema || "").toString().trim();
  if (!tema) {
    res.status(400).json({ error: "Envie ?tema=alguma coisa" });
    return;
  }

  // variação nos resultados a cada chamada (botão "embaralhar"), sem custo
  const seedPage = Math.max(1, Math.min(3, parseInt(req.query.variacao, 10) || 1));

  try {
    const results = await Promise.all(
      SHOT_LIST.map(async (shot) => {
        const query = `${tema} ${shot.suffix}`;
        const data = await searchUnsplash(query, accessKey, seedPage);
        const pool = data.results && data.results.length ? data.results : null;

        if (!pool) {
          // fallback: tenta sem o sufixo, só o tema puro
          const fallback = await searchUnsplash(tema, accessKey, seedPage);
          const fpool = fallback.results;
          if (!fpool || !fpool.length) return null;
          const pick = fpool[Math.floor(Math.random() * Math.min(5, fpool.length))];
          trackDownload(pick.links?.download_location, accessKey);
          return {
            role: shot.role,
            url: pick.urls.regular,
            credit: pick.user?.name || "Unsplash",
            creditUrl: pick.links?.html,
            alt: pick.alt_description || tema,
          };
        }

        const pick = pool[Math.floor(Math.random() * Math.min(5, pool.length))];
        trackDownload(pick.links?.download_location, accessKey);
        return {
          role: shot.role,
          url: pick.urls.regular,
          credit: pick.user?.name || "Unsplash",
          creditUrl: pick.links?.html,
          alt: pick.alt_description || tema,
        };
      })
    );

    const images = results.filter(Boolean);

    res.status(200).json({
      tema,
      template: TEMPLATE_7,
      images,
    });
  } catch (err) {
    res.status(502).json({ error: err.message || "Falha ao buscar fotos" });
  }
}

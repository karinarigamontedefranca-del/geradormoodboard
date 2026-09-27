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
// Pixabay, e cai pra próxima quando uma busca não retornar nada relevante.
//
// RELEVÂNCIA: cada resultado é pontuado por quantas palavras do tema
// aparecem na sua própria descrição/tags. Na primeira geração usamos sempre
// o resultado mais relevante; a aleatoriedade (botão "Embaralhar") só entra
// entre os resultados que também passaram no filtro de relevância — nunca
// entre resultados fracos.

const SHOT_LIST = [
  { role: "ambiente", suffix: "ambiente loja" },
  { role: "produto1", suffix: "close up" },
  { role: "textura", suffix: "textura" },
  { role: "acao", suffix: "mãos" },
  { role: "detalhe", suffix: "detalhe" },
  { role: "produto2", suffix: "vitrine" },
  { role: "atmosfera", suffix: "decoração" },
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

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "os", "as", "em", "com",
  "para", "no", "na", "nos", "nas", "um", "uma", "uns", "umas", "por", "que",
]);

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acentos
}

// palavras "de peso" do tema (ignora conectivos e palavras curtas demais)
function themeKeywords(tema) {
  return normalize(tema)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

// pontua um item pelo número de palavras do tema que aparecem no seu texto
function relevanceScore(text, keywords) {
  const t = normalize(text);
  return keywords.reduce((score, kw) => (t.includes(kw) ? score + 1 : score), 0);
}

// ordena o pool por relevância (mantendo a ordem original em caso de empate,
// que já é a ordem de relevância do próprio banco de imagens)
function rankByRelevance(pool, keywords, textOf) {
  return pool
    .map((item, idx) => ({ item, idx, score: relevanceScore(textOf(item), keywords) }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);
}

// --- Provedores -----------------------------------------------------------
// Cada provedor devolve o pool JÁ ordenado por relevância ao tema (ou null).

async function searchUnsplash(query, keywords, page) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "20");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");
  if (page) url.searchParams.set("page", String(page));

  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.results || !data.results.length) return null;

  const ranked = rankByRelevance(
    data.results,
    keywords,
    (p) => `${p.alt_description || ""} ${p.description || ""} ${(p.tags || []).map((t) => t.title).join(" ")}`
  );

  return ranked.map(({ item, score }) => ({
    score,
    photo: {
      url: item.urls.regular,
      credit: item.user?.name || "Unsplash",
      creditUrl: item.links?.html,
      alt: item.alt_description,
      source: "Unsplash",
      _downloadLocation: item.links?.download_location,
    },
  }));
}

async function searchPexels(query, keywords, page) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "20");
  url.searchParams.set("orientation", "landscape");
  if (page) url.searchParams.set("page", String(page));

  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.photos || !data.photos.length) return null;

  const ranked = rankByRelevance(data.photos, keywords, (p) => p.alt || "");

  return ranked.map(({ item, score }) => ({
    score,
    photo: {
      url: item.src?.large || item.src?.medium,
      credit: item.photographer || "Pexels",
      creditUrl: item.url,
      alt: item.alt,
      source: "Pexels",
    },
  }));
}

async function searchPixabay(query, keywords, page) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return null;

  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", query);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", "horizontal");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", "20");
  if (page) url.searchParams.set("page", String(page));

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.hits || !data.hits.length) return null;

  // Pixabay dá "tags" como string separada por vírgula — o campo mais
  // confiável pra checar relevância, já que não tem alt_description.
  const ranked = rankByRelevance(data.hits, keywords, (p) => p.tags || "");

  return ranked.map(({ item, score }) => ({
    score,
    photo: {
      url: item.largeImageURL || item.webformatURL,
      credit: item.user || "Pixabay",
      creditUrl: item.pageURL,
      alt: item.tags,
      source: "Pixabay",
    },
  }));
}

const PROVIDERS = [searchUnsplash, searchPexels, searchPixabay];

// junta os pools relevantes de todos os provedores configurados pra uma
// consulta, mantendo o score de relevância de cada foto
async function collectRanked(query, keywords, page) {
  const pools = await Promise.all(
    PROVIDERS.map((provider) => provider(query, keywords, page).catch(() => null))
  );
  return pools.filter(Boolean).flat();
}

// escolhe a melhor foto pra um "papel" do shot list, tentando primeiro
// "{tema} {sufixo}" e caindo pro tema puro se nada relevante aparecer
async function pickForShot(tema, keywords, shot, page, variacaoIdx) {
  let pool = await collectRanked(`${tema} ${shot.suffix}`, keywords, page);

  // exige pelo menos 1 palavra do tema batendo — senão tenta o tema puro
  let relevant = pool.filter((p) => p.score > 0);
  if (!relevant.length) {
    pool = await collectRanked(tema, keywords, page);
    relevant = pool.filter((p) => p.score > 0);
  }

  // nada relevante em lugar nenhum: melhor deixar vazio do que forçar foto
  // sem nenhuma relação com o tema
  if (!relevant.length) return null;

  relevant.sort((a, b) => b.score - a.score);
  const topScore = relevant[0].score;
  const topTier = relevant.filter((p) => p.score === topScore);

  // 1ª geração (variacaoIdx=0): sempre a foto mais relevante.
  // Embaralhar (variacaoIdx>0): varia só entre as igualmente relevantes.
  const chosen = variacaoIdx === 0
    ? topTier[0]
    : topTier[variacaoIdx % topTier.length];

  const photo = chosen.photo;
  if (photo.source === "Unsplash" && photo._downloadLocation) {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    const dl = photo._downloadLocation;
    fetch(`${dl}${dl.includes("?") ? "&" : "?"}client_id=${key}`).catch(() => {});
  }
  const { _downloadLocation, ...clean } = photo;
  return { role: shot.role, score: chosen.score, ...clean };
}

// --- Handler ----------------------------------------------------------

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

  const keywords = themeKeywords(tema);
  if (!keywords.length) {
    res.status(400).json({ error: "Escreva um tema com pelo menos uma palavra específica." });
    return;
  }

  const variacaoIdx = Math.max(0, (parseInt(req.query.variacao, 10) || 1) - 1);
  const page = 1 + Math.floor(variacaoIdx / 3); // muda de página a cada 3 embaralhadas

  try {
    const picked = await Promise.all(
      SHOT_LIST.map((shot) => pickForShot(tema, keywords, shot, page, variacaoIdx))
    );

    const images = picked.filter(Boolean);
    const faltando = SHOT_LIST.length - images.length;

    res.status(200).json({
      tema,
      template: TEMPLATE_7,
      images,
      faltando, // quantos "papéis" ficaram sem foto relevante o suficiente
      fontes: { unsplash: hasUnsplash, pexels: hasPexels, pixabay: hasPixabay },
    });
  } catch (err) {
    res.status(502).json({ error: err.message || "Falha ao buscar fotos" });
  }
}

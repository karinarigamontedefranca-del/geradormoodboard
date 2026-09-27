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
// Se mais de uma estiver configurada, os resultados de todas são somados e
// ranqueados juntos por relevância ao tema.
//
// RELEVÂNCIA: cada resultado é pontuado por quantas palavras do tema
// aparecem na sua própria descrição/tags. Na primeira geração usamos sempre
// o resultado mais relevante; a aleatoriedade (botão "Embaralhar") só entra
// entre os resultados que também passaram no filtro de relevância — nunca
// entre resultados fracos.
//
// IMPORTANTE: a busca que vai pras APIs é SÓ o tema (traduzido pra inglês),
// nunca tema+sufixo. Colar um sufixo tipo "hands" ou "close up" na busca
// (versão anterior deste arquivo) faz o próprio buscador do Unsplash/
// Pexels/Pixabay perder o foco no tema e priorizar o sufixo — por isso
// buscar só "coworking" no Unsplash dá resultado ótimo, mas "coworking
// hands" traz qualquer foto de mão/perna digitando. Os "sufixos" abaixo
// (boostWords) servem só de DESEMPATE interno pra decidir qual foto, DENTRE
// as já filtradas como relevantes ao tema, cai em qual célula do grid —
// nunca pra decidir se uma foto é relevante.
const SHOT_LIST = [
  { role: "ambiente", boostWords: ["interior", "room", "space", "indoor", "shop"] },
  { role: "produto1", boostWords: ["closeup", "close", "product"] },
  { role: "textura", boostWords: ["texture", "pattern", "material", "wood", "fabric", "surface"] },
  { role: "acao", boostWords: ["hands", "hand", "typing", "working"] },
  { role: "detalhe", boostWords: ["detail", "close"] },
  { role: "produto2", boostWords: ["storefront", "sign", "entrance", "facade", "window", "display"] },
  { role: "atmosfera", boostWords: ["decor", "decoration", "light", "plant", "cozy", "ambience"] },
];

// Reforço de ESTILO (não de tema): aplicado em toda foto, de todo papel, não
// só num específico. É o que aproxima do padrão visual das referências da
// Rachel (fotografia editorial de arquitetura/interior — plantas, madeira,
// luz natural, poucas ou nenhuma pessoa em close) em vez de foto de banco
// de imagens genérica de gente sorrindo pro computador. Isso NÃO restringe
// o tema (uma foto sem nenhuma dessas palavras ainda pode ser escolhida se
// não houver opção melhor) — só desempata a favor do visual mais editorial
// quando há mais de uma foto igualmente relevante ao tema.
const STYLE_BOOST_WORDS = [
  "interior", "architecture", "design", "plant", "plants", "wood", "wooden",
  "natural light", "minimal", "aesthetic", "cozy", "botanical", "greenery",
];

// palavras que costumam indicar foto de banco de imagens genérica/pose de
// still de "trabalho remoto" (a antítese do editorial) — usado como um
// PEQUENO desconto na pontuação de desempate, não como exclusão.
const GENERIC_STOCK_WORDS = [
  "digital nomad", "freelancer", "smiling", "portrait", "businessman",
  "businesswoman", "stock photo",
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

// Dicionário PT -> EN pra palavras comuns de tema de moodboard/vitrine.
// Por quê: os bancos de imagem são indexados majoritariamente em inglês, e
// várias palavras em português são AMBÍGUAS quando usadas cru na busca —
// o caso que motivou isso foi "natal": bate tanto com "Christmas" quanto
// com "Natal" a cidade litorânea do Rio Grande do Norte, então uma busca
// por "feira de natal" trazia fotos de praia/rochedo (geolocalizadas na
// cidade de Natal) como se fossem "relevantes". Traduzindo pra inglês antes
// de buscar E de pontuar relevância, essa colisão de nomes desaparece,
// porque "christmas" não é nome de nenhuma cidade.
// Chaves sem acento (já é assim que o texto chega depois do normalize()).
const PT_EN_DICT = {
  natal: "christmas",
  natalino: "christmas",
  natalina: "christmas",
  feira: "fair",
  feirinha: "fair",
  mercado: "market",
  mercadinho: "market",
  loja: "store",
  lojinha: "store",
  lojas: "stores",
  vitrine: "storefront",
  vitrines: "storefront",
  decoracao: "decoration",
  decoracoes: "decorations",
  pascoa: "easter",
  verao: "summer",
  inverno: "winter",
  primavera: "spring",
  outono: "autumn",
  praia: "beach",
  festa: "party",
  festas: "party",
  festival: "festival",
  aniversario: "birthday",
  infantil: "kids",
  criancas: "children",
  crianca: "child",
  pet: "pet",
  pets: "pets",
  livraria: "bookstore",
  livros: "books",
  livro: "book",
  cafe: "coffee",
  cafeteria: "cafe",
  perfumaria: "perfumery",
  perfume: "perfume",
  moda: "fashion",
  roupas: "clothes",
  roupa: "clothing",
  joalheria: "jewelry",
  joias: "jewelry",
  tecnologia: "technology",
  gastronomia: "food",
  doces: "sweets",
  doce: "candy",
  flores: "flowers",
  flor: "flower",
  plantas: "plants",
  planta: "plant",
  oktoberfest: "oktoberfest",
  cerveja: "beer",
  vinho: "wine",
  casamento: "wedding",
  formatura: "graduation",
  coworking: "coworking",
  esporte: "sport",
  esportes: "sports",
  outlet: "outlet",
  arvore: "tree",
  arvores: "trees",
  luzes: "lights",
  luz: "light",
  presente: "gift",
  presentes: "gifts",
  anime: "anime",
  animes: "anime",
  halloween: "halloween",
  fantasia: "costume",
  fantasias: "costumes",
  terror: "horror",
  abobora: "pumpkin",
  aboboras: "pumpkins",
  neve: "snow",
  cabana: "cabin",
  pinheiro: "pine tree",
};

function translateWord(w) {
  return PT_EN_DICT[w] || null;
}

// termos de busca de fato enviados às APIs: cada palavra do tema é trocada
// pela tradução em inglês quando existe uma (bancos de imagem indexam
// majoritariamente em inglês, então isso melhora a busca em geral, além de
// resolver ambiguidades tipo "natal").
function queryTerms(tema) {
  return normalize(tema)
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w)) // remove conectivos em PT (ex: "de")
    .map((w) => translateWord(w) || w)
    .join(" ");
}

// palavras "de peso" do tema (ignora conectivos e palavras curtas demais),
// já traduzidas pra inglês quando há tradução conhecida — usar SÓ a
// tradução (e não a palavra original) quando ela existe é o que evita a
// foto de praia entrar pontuada como relevante pra "natal".
function themeKeywords(tema) {
  return normalize(tema)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .map((w) => translateWord(w) || w);
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
  url.searchParams.set("per_page", "30");
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
  url.searchParams.set("per_page", "30");
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
  url.searchParams.set("per_page", "30");
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

function pingUnsplashDownload(photo) {
  if (photo.source === "Unsplash" && photo._downloadLocation) {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    const dl = photo._downloadLocation;
    fetch(`${dl}${dl.includes("?") ? "&" : "?"}client_id=${key}`).catch(() => {});
  }
}

// Unsplash/Pexels entram sempre antes do Pixabay: o Pixabay tende a ter
// fotografia mais datada/corporativa E listas de tags repetidas dezenas de
// vezes (ex: "office, office, office...") que, se contadas cru, inflam
// artificialmente o desempate a favor dele. Tier 0 = tentamos usar só
// essas fontes primeiro; o Pixabay (tier 1) só entra pra completar o que
// faltar.
function providerTier(source) {
  return source === "Pixabay" ? 1 : 0;
}

// busca UMA VEZ (por tema puro, sem sufixo) e distribui fotos DISTINTAS
// entre os 7 papéis do shot list. O desempate combina três coisas, nessa
// ordem de prioridade:
//   1. fonte (Unsplash/Pexels antes de Pixabay, ver providerTier)
//   2. estilo editorial (STYLE_BOOST_WORDS) menos "cara de stock genérico"
//      (GENERIC_STOCK_WORDS) — aproxima do visual das referências da Rachel
//   3. o quanto a legenda bate com o tipo de plano daquele papel (boostWords)
// Nada disso decide SE a foto é relevante ao tema — isso já foi decidido
// pelo score>0 (linha abaixo). E o "match" de cada lista de palavras é
// tratado como sim/não (no máx. +1), nunca somando 1 ponto por palavra
// repetida — é isso que impede uma legenda com dezenas de tags de vencer
// só por ter mais chance de bater em alguma palavra.
async function pickAllShots(temaQuery, keywords, page, variacaoIdx) {
  const pool = await collectRanked(temaQuery, keywords, page);

  // só entram no jogo fotos que batem com pelo menos 1 palavra real do
  // tema — o resto fica de fora (melhor faltar foto que mostrar algo sem
  // relação nenhuma com o tema)
  const relevant = pool.filter((p) => p.score > 0);
  if (!relevant.length) return SHOT_LIST.map(() => null);

  const usedUrls = new Set();

  return SHOT_LIST.map((shot) => {
    const candidates = relevant
      .filter((p) => !usedUrls.has(p.photo.url))
      .map((p) => {
        const alt = p.photo.alt || "";
        const styleHit = relevanceScore(alt, STYLE_BOOST_WORDS) > 0 ? 1 : 0;
        const genericHit = relevanceScore(alt, GENERIC_STOCK_WORDS) > 0 ? 1 : 0;
        const roleHit = relevanceScore(alt, shot.boostWords) > 0 ? 1 : 0;
        return {
          ...p,
          tier: providerTier(p.photo.source),
          boost: styleHit - genericHit + roleHit,
        };
      })
      .sort((a, b) => a.tier - b.tier || b.boost - a.boost);

    if (!candidates.length) return null;

    const topTierValue = candidates[0].tier;
    const topBoost = candidates.find((p) => p.tier === topTierValue).boost;
    const tier = candidates.filter((p) => p.tier === topTierValue && p.boost === topBoost);

    // 1ª geração (variacaoIdx=0): sempre a mais relevante/mais parecida com
    // o papel. Embaralhar (variacaoIdx>0): varia só entre as empatadas.
    const chosen = variacaoIdx === 0 ? tier[0] : tier[variacaoIdx % tier.length];

    usedUrls.add(chosen.photo.url);
    pingUnsplashDownload(chosen.photo);
    const { _downloadLocation, ...clean } = chosen.photo;
    return { role: shot.role, score: chosen.score, ...clean };
  });
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
  const temaQuery = queryTerms(tema);

  const variacaoIdx = Math.max(0, (parseInt(req.query.variacao, 10) || 1) - 1);
  const page = 1 + Math.floor(variacaoIdx / 3); // muda de página a cada 3 embaralhadas

  try {
    const picked = await pickAllShots(temaQuery, keywords, page, variacaoIdx);

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

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
// biblioteca de papéis (mais que os 7 originais, pra dar conta dos
// templates de 8 e 9 fotos) — cada template usa só os N primeiros.
const ROLE_LIBRARY = [
  { role: "ambiente", boostWords: ["interior", "room", "space", "indoor", "shop"] },
  { role: "produto1", boostWords: ["closeup", "close", "product"] },
  { role: "textura", boostWords: ["texture", "pattern", "material", "wood", "fabric", "surface"] },
  // Antes tinha "hands"/"typing" aqui — isso ativamente puxava fotos de mão
  // digitando pro papel "ação" (contradizendo o guia de estilo, que pede
  // "objeto em uso, sem mão/pessoa"), e o pior: cancelava o desconto do
  // GENERIC_STOCK_WORDS (mesma foto batendo +1 aqui e -1 lá = 0 líquido,
  // como se fosse uma foto neutra). Agora o papel busca objeto em uso/
  // deslocado, sem magnetizar foto de gente.
  { role: "acao", boostWords: ["open", "unboxed", "unpacked", "in use", "half open"] },
  { role: "detalhe", boostWords: ["detail", "close"] },
  { role: "produto2", boostWords: ["storefront", "sign", "entrance", "facade", "window", "display"] },
  { role: "atmosfera", boostWords: ["decor", "decoration", "light", "plant", "cozy", "ambience"] },
  { role: "detalhe2", boostWords: ["detail", "texture", "close"] },
  { role: "produto3", boostWords: ["product", "closeup", "detail"] },
];
const SHOT_LIST = ROLE_LIBRARY.slice(0, 7);

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
  "businesswoman", "stock photo", "hands", "hand", "typing", "fingers",
  "person typing", "woman working", "man working", "top view desk",
  "flat lay desk",
];

// Proporções de cada template — calibradas visualmente a partir dos
// moodboards de referência da Rachel (mistura de coluna cheia + colunas
// divididas em 2 células empilhadas, larguras desiguais). Templates com
// mais fotos têm células menores (mais fragmentado); com menos fotos,
// células maiores. "id" é o que aparece no seletor de template do site.
const TEMPLATES = {
  6: {
    label: "6 fotos — mais amplo",
    rects: [
      { left: 0, top: 0, width: 0.225, height: 0.444 },
      { left: 0.25, top: 0, width: 0.225, height: 0.444 },
      { left: 0, top: 0.478, width: 0.47, height: 0.514 },
      { left: 0.495, top: 0, width: 0.245, height: 0.984 },
      { left: 0.76, top: 0, width: 0.11, height: 0.444 },
      { left: 0.76, top: 0.478, width: 0.235, height: 0.514 },
    ],
  },
  7: {
    label: "7 fotos — padrão",
    rects: [
      { left: 0.0, top: 0.0, width: 0.266, height: 1.0 },
      { left: 0.274, top: 0.0, width: 0.196, height: 0.575 },
      { left: 0.274, top: 0.585, width: 0.196, height: 0.415 },
      { left: 0.478, top: 0.0, width: 0.226, height: 0.675 },
      { left: 0.478, top: 0.685, width: 0.226, height: 0.315 },
      { left: 0.714, top: 0.0, width: 0.286, height: 0.445 },
      { left: 0.714, top: 0.455, width: 0.286, height: 0.545 },
    ],
  },
  8: {
    label: "8 fotos — mais fragmentado",
    rects: [
      { left: 0, top: 0, width: 0.145, height: 0.139 },
      { left: 0.165, top: 0, width: 0.145, height: 0.139 },
      { left: 0, top: 0.173, width: 0.305, height: 0.399 },
      { left: 0.33, top: 0, width: 0.145, height: 0.564 },
      { left: 0, top: 0.598, width: 0.47, height: 0.394 },
      { left: 0.495, top: 0, width: 0.225, height: 0.664 },
      { left: 0.495, top: 0.693, width: 0.225, height: 0.299 },
      { left: 0.74, top: 0, width: 0.255, height: 0.984 },
    ],
  },
  9: {
    label: "9 fotos — editorial denso",
    rects: [
      { left: 0, top: 0, width: 0.145, height: 0.139 },
      { left: 0.165, top: 0, width: 0.145, height: 0.139 },
      { left: 0.325, top: 0, width: 0.145, height: 0.139 },
      { left: 0, top: 0.173, width: 0.465, height: 0.404 },
      { left: 0, top: 0.603, width: 0.465, height: 0.389 },
      { left: 0.49, top: 0, width: 0.225, height: 0.534 },
      { left: 0.49, top: 0.568, width: 0.225, height: 0.424 },
      { left: 0.735, top: 0, width: 0.26, height: 0.604 },
      { left: 0.735, top: 0.638, width: 0.26, height: 0.354 },
    ],
  },
};

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
  pipoca: "popcorn",
  algodao: "cotton",
  sorvete: "ice cream",
  chocolate: "chocolate",
  brinquedo: "toy",
  brinquedos: "toys",
  balao: "balloon",
  baloes: "balloons",
  pizza: "pizza",
  hamburguer: "burger",
  brigadeiro: "brigadeiro",
  cupcake: "cupcake",
  biscoito: "cookie",
  biscoitos: "cookies",
  bolo: "cake",
};

// Frases inteiras (2+ palavras) que precisam ser traduzidas como bloco —
// traduzir palavra por palavra quebraria o sentido (ex: "algodão" + "doce"
// separados não formam "cotton candy"). Aplicado ANTES da tradução por
// palavra, então essas frases têm prioridade. Cobre principalmente comidas
// de feira/festa, comuns nos "elementos específicos" (ver ELEMENTOS mais
// abaixo), já que é o caso de uso mais provável pra frases assim.
const PHRASE_DICT = {
  "algodao doce": "cotton candy",
  "maca do amor": "candy apple",
  "cachorro quente": "hot dog",
  "milho verde": "corn on the cob",
  "arvore de natal": "christmas tree",
  "pipoca doce": "sweet popcorn",
  "bala de goma": "gummy candy",
  "picole": "popsicle",
};

function applyPhraseDict(normalizedStr) {
  let out = normalizedStr;
  // frases mais longas primeiro, pra uma frase curta não "roubar" parte de
  // uma mais longa que a contém
  const phrases = Object.keys(PHRASE_DICT).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    if (out.includes(phrase)) out = out.split(phrase).join(PHRASE_DICT[phrase]);
  }
  return out;
}

function translateWord(w) {
  return PT_EN_DICT[w] || null;
}

// termos de busca de fato enviados às APIs: cada palavra do tema é trocada
// pela tradução em inglês quando existe uma (bancos de imagem indexam
// majoritariamente em inglês, então isso melhora a busca em geral, além de
// resolver ambiguidades tipo "natal").
function queryTerms(tema) {
  return applyPhraseDict(normalize(tema))
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
  return applyPhraseDict(normalize(tema))
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

// Busca páginas extras até ter fotos relevantes (score>0) suficientes pra
// preencher `neededDistinct` papéis, ou até esgotar o limite de páginas.
// Por quê: antes, o board inteiro (todos os papéis genéricos) dividia um
// único pool de 1 página (30 fotos por provedor) — em temas mais
// específicos, ou nos templates de 8/9 fotos (mais papéis pra preencher),
// esse pool ficava sem fotos "relevantes o bastante" sobrando antes de
// cobrir todos os papéis, e a célula ficava vazia ("faltando uma foto no
// canto"). Buscando páginas extras sob demanda, o pool cresce só quando
// necessário.
const MAX_EXTRA_PAGES = 2;
async function collectRankedDeep(query, keywords, startPage, neededDistinct) {
  const seen = new Set();
  const merged = [];
  for (let i = 0; i <= MAX_EXTRA_PAGES; i++) {
    const batch = await collectRanked(query, keywords, startPage + i);
    for (const item of batch) {
      if (seen.has(item.photo.url)) continue;
      seen.add(item.photo.url);
      merged.push(item);
    }
    const distinctRelevant = merged.reduce((n, p) => (p.score > 0 ? n + 1 : n), 0);
    if (distinctRelevant >= neededDistinct) break;
  }
  return merged;
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

// ordem de preferência pra um papel ser "tomado" por um elemento específico
// que a Rachel pediu (ex: "pipoca", "algodão doce"): qualquer papel menos
// "ambiente" primeiro (do mais livre pro mais estrutural), "ambiente" (a
// foto grande, âncora do board) só se sobrar elemento depois de preencher
// todos os outros — funciona pra shot list de qualquer tamanho (6 a 9).
function elementReplaceOrder(shotList) {
  const others = shotList.map((s) => s.role).filter((r) => r !== "ambiente");
  return shotList.some((s) => s.role === "ambiente") ? [...others, "ambiente"] : others;
}

// monta o shot list de uma geração a partir do template escolhido (número
// de fotos), e cada "elemento específico" pedido (lista de textos livres)
// ocupa um papel, virando uma busca PRÓPRIA (independente da busca geral do
// tema) — sem elementos, o comportamento é o padrão pra aquele template.
function buildShotList(templateSize, elementos) {
  const base = ROLE_LIBRARY.slice(0, templateSize).map((s) => ({ ...s }));
  const byRole = Object.fromEntries(base.map((s) => [s.role, s]));
  const order = elementReplaceOrder(base);
  elementos.slice(0, base.length).forEach((elemento, i) => {
    const role = order[i];
    if (role && byRole[role]) byRole[role].elemento = elemento;
  });
  return base;
}

// pontua e ordena um pool de candidatos (já filtrado por relevância) pro
// desempate de um papel específico. Combina, nessa ordem de prioridade:
//   1. fonte (Unsplash/Pexels antes de Pixabay, ver providerTier)
//   2. estilo editorial (STYLE_BOOST_WORDS) menos "cara de stock genérico"
//      (GENERIC_STOCK_WORDS) — aproxima do visual das referências da Rachel
//   3. o quanto a legenda bate com o tipo de plano daquele papel (boostWords)
// O "match" de cada lista de palavras é sim/não (no máx. +1), nunca soma 1
// ponto por palavra repetida — é isso que impede uma legenda com dezenas de
// tags ganhar só por ter mais chance de bater em alguma palavra.
function rankCandidates(pool, boostWords) {
  return pool
    .map((p) => {
      const alt = p.photo.alt || "";
      const styleHit = relevanceScore(alt, STYLE_BOOST_WORDS) > 0 ? 1 : 0;
      const genericHit = relevanceScore(alt, GENERIC_STOCK_WORDS) > 0 ? 1 : 0;
      const roleHit = relevanceScore(alt, boostWords) > 0 ? 1 : 0;
      // genericHit pesa o dobro do styleHit: sem isso, uma foto de "mão
      // digitando numa mesa de madeira" batia +1 em STYLE_BOOST_WORDS
      // ("wood") e -1 em GENERIC_STOCK_WORDS ("hands"), empatando em 0 com
      // uma foto totalmente neutra — nunca perdendo por ser "gente
      // trabalhando". Com o peso dobrado, essa mesma foto fica em -1,
      // atrás de qualquer alternativa neutra ou editorial disponível.
      return { ...p, tier: providerTier(p.photo.source), boost: styleHit - genericHit * 2 + roleHit };
    })
    .sort((a, b) => a.tier - b.tier || b.boost - a.boost);
}

// escolhe 1 foto de um pool já ranqueado, respeitando "já usadas" e a
// variação do botão Embaralhar (mesma foto sempre na 1ª geração; só varia
// entre as empatadas quando variacaoIdx>0)
function pickOne(rankedPool, usedUrls, variacaoIdx) {
  const candidates = rankedPool.filter((p) => !usedUrls.has(p.photo.url));
  if (!candidates.length) return null;

  const topTierValue = candidates[0].tier;
  const topBoost = candidates.find((p) => p.tier === topTierValue).boost;
  const tier = candidates.filter((p) => p.tier === topTierValue && p.boost === topBoost);

  return variacaoIdx === 0 ? tier[0] : tier[variacaoIdx % tier.length];
}

function finalizeImage(role, query, chosen) {
  pingUnsplashDownload(chosen.photo);
  const { _downloadLocation, ...clean } = chosen.photo;
  return { role, score: chosen.score, query, ...clean };
}

// gera o board inteiro: papéis "de elemento" (ver buildShotList) fazem cada
// um sua PRÓPRIA busca (independente do tema, pra não diluir a relevância
// do elemento pedido); os demais papéis dividem uma única busca pelo tema
// puro. Elementos são resolvidos primeiro (pool mais estreito, menos
// opção), o resto depois, pra não sobrar elemento sem foto por causa de um
// papel genérico ter "roubado" a única foto boa daquele elemento.
async function pickAllShots(tema, temaQuery, keywords, page, variacaoIdx, shotList) {
  const elementShots = shotList.filter((s) => s.elemento);
  const genericShots = shotList.filter((s) => !s.elemento);

  const usedUrls = new Set();
  const results = {};

  // 1) papéis de elemento específico
  for (const shot of elementShots) {
    const elQuery = queryTerms(shot.elemento);
    const elKeywords = themeKeywords(shot.elemento);
    const pool = elKeywords.length ? await collectRankedDeep(elQuery, elKeywords, page, 1) : [];
    const relevant = rankCandidates(pool.filter((p) => p.score > 0), shot.boostWords);
    let chosen = pickOne(relevant, usedUrls, variacaoIdx);
    // fallback: nenhuma foto bateu o filtro de relevância mesmo com páginas
    // extras — melhor preencher com a foto menos ruim do pool inteiro do que
    // deixar essa célula vazia
    if (!chosen && pool.length) {
      const anyRanked = rankCandidates(pool, shot.boostWords);
      chosen = pickOne(anyRanked, usedUrls, variacaoIdx);
    }
    if (chosen) {
      usedUrls.add(chosen.photo.url);
      results[shot.role] = finalizeImage(shot.role, shot.elemento, chosen);
    } else {
      results[shot.role] = null;
    }
  }

  // 2) papéis genéricos, todos a partir de UMA busca pelo tema (com páginas
  // extras sob demanda, ver collectRankedDeep)
  if (genericShots.length) {
    const pool = await collectRankedDeep(temaQuery, keywords, page, genericShots.length);
    const relevant = pool.filter((p) => p.score > 0);
    for (const shot of genericShots) {
      const disponiveis = pool.filter((p) => !usedUrls.has(p.photo.url));
      const relevantesDisponiveis = relevant.filter((p) => !usedUrls.has(p.photo.url));
      const ranked = rankCandidates(relevantesDisponiveis, shot.boostWords);
      let chosen = pickOne(ranked, usedUrls, variacaoIdx);
      // mesmo fallback: sem foto relevante sobrando pra esse papel, usa a
      // melhor disponível do pool inteiro em vez de deixar buraco no grid
      if (!chosen && disponiveis.length) {
        const anyRanked = rankCandidates(disponiveis, shot.boostWords);
        chosen = pickOne(anyRanked, usedUrls, variacaoIdx);
      }
      if (chosen) {
        usedUrls.add(chosen.photo.url);
        results[shot.role] = finalizeImage(shot.role, tema, chosen);
      } else {
        results[shot.role] = null;
      }
    }
  }

  // devolve na ordem original do shot list, pra bater com o TEMPLATE_7
  return shotList.map((shot) => results[shot.role] || null);
}

// troca UMA foto específica (botão "Alterar imagem"): busca só o termo
// pedido (ou o mesmo termo que gerou a foto atual, se for só "gerar
// outra"), nunca combinado com o tema — mesma lógica de sempre, só que
// escopada a 1 papel só. `excluirUrls` evita repetir fotos já mostradas
// nessa célula durante a mesma sessão de troca.
async function pickSingleShot(busca, role, excluirUrls, page, variacaoIdx) {
  const shotDef = ROLE_LIBRARY.find((s) => s.role === role) || { role, boostWords: [] };
  const query = queryTerms(busca);
  const keywords = themeKeywords(busca);
  if (!keywords.length) return { error: "Escreva um termo de busca com pelo menos uma palavra específica." };

  const pool = await collectRankedDeep(query, keywords, page, 1);
  const relevant = pool.filter((p) => p.score > 0 && !excluirUrls.has(p.photo.url));
  const ranked = rankCandidates(relevant, shotDef.boostWords);
  let chosen = pickOne(ranked, new Set(), variacaoIdx);
  if (!chosen) {
    const anyLeft = pool.filter((p) => !excluirUrls.has(p.photo.url));
    const anyRanked = rankCandidates(anyLeft, shotDef.boostWords);
    chosen = pickOne(anyRanked, new Set(), variacaoIdx);
  }
  if (!chosen) return { image: null };

  return { image: finalizeImage(role, busca, chosen) };
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

  const variacaoIdx = Math.max(0, (parseInt(req.query.variacao, 10) || 1) - 1);
  const page = 1 + Math.floor(variacaoIdx / 3); // muda de página a cada 3 embaralhadas

  // --- troca de UMA foto específica ("Alterar imagem" numa célula já
  // gerada) — atalho que ignora o resto do board inteiro. Precisa de
  // ?role=<papel> e usa ?busca=<termo> se enviado, senão ?tema= mesmo (pra
  // "gerar outra" sem trocar o termo de busca). ?excluir=<url1,url2,...>
  // evita repetir fotos já mostradas naquela célula.
  const role = (req.query.role || "").toString().trim();
  if (role) {
    const busca = (req.query.busca || tema).toString().trim();
    const excluirUrls = new Set(
      (req.query.excluir || "")
        .toString()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    try {
      const result = await pickSingleShot(busca, role, excluirUrls, page, variacaoIdx);
      if (result.error) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.status(200).json({ role, image: result.image });
    } catch (err) {
      res.status(502).json({ error: err.message || "Falha ao buscar foto" });
    }
    return;
  }

  const keywords = themeKeywords(tema);
  if (!keywords.length) {
    res.status(400).json({ error: "Escreva um tema com pelo menos uma palavra específica." });
    return;
  }
  const temaQuery = queryTerms(tema);

  const templateId = parseInt(req.query.template, 10);
  const templateSize = TEMPLATES[templateId] ? templateId : 7;
  const template = TEMPLATES[templateSize];

  // elementos específicos (opcional): lista separada por vírgula, ex:
  // "pipoca, algodão doce" — cada um vira a busca de um papel do board.
  const elementos = (req.query.elementos || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const shotList = buildShotList(templateSize, elementos);

  try {
    const picked = await pickAllShots(tema, temaQuery, keywords, page, variacaoIdx, shotList);

    const images = picked.filter(Boolean);
    const faltando = shotList.length - images.length;

    res.status(200).json({
      tema,
      templateId: templateSize,
      template: template.rects,
      // ordem dos papéis, posição a posição, casando com "template" acima —
      // o front-end usa isso em vez de uma lista fixa, já que o tamanho e a
      // ordem mudam de template pra template
      roles: shotList.map((s) => s.role),
      templates: Object.fromEntries(
        Object.entries(TEMPLATES).map(([id, t]) => [id, t.label])
      ),
      images,
      faltando, // quantos "papéis" ficaram sem foto relevante o suficiente
      fontes: { unsplash: hasUnsplash, pexels: hasPexels, pixabay: hasPixabay },
    });
  } catch (err) {
    res.status(502).json({ error: err.message || "Falha ao buscar fotos" });
  }
}

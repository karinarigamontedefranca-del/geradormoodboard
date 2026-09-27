# Gerador de Moodboard — grátis, sem IA

Site com um campo de texto: você escreve um tema, ele busca 7 fotos reais em
bancos de imagens gratuitos (Unsplash e/ou Pexels) e monta o board no
formato bento dos moodboards de referência (a mesma grade assimétrica: 1
foto grande, colunas divididas em cima/baixo, respiro fino entre as fotos).

Não chama nenhuma API de IA — zero tokens, zero custo. Os únicos serviços
externos são as buscas de imagem, que são gratuitas.

Você pode configurar **qualquer combinação** dos três bancos (Unsplash,
Pexels, Pixabay) — mesmo só um já funciona. Com mais de um configurado, o
sistema tenta na ordem Unsplash → Pexels → Pixabay e cai pro próximo
automaticamente quando uma busca não retorna nada bom — cobre mais temas.

## Passo a passo pra colocar no ar (uns 10 minutos)

### 1. Crie chaves gratuitas dos bancos de imagens

**Unsplash** (opcional, mas recomendado):
1. Entre em https://unsplash.com/developers e faça login/cadastro (grátis).
2. Clique em **"New Application"** (ou "Your apps" → "New Application").
3. Aceite os termos, dê um nome qualquer pro app (ex: "Moodboard Rachel").
4. Na página do app criado, copie o **Access Key**.

Dá 50 buscas por hora de graça, pra sempre. Não pede cartão.

**Pexels** (opcional, mas recomendado):
1. Entre em https://www.pexels.com/api/ e faça login/cadastro (grátis).
2. Clique em **"Get Started"** / **"Your API Key"**.
3. Copie a chave que aparece na tela (não precisa preencher formulário
   nenhum de aprovação — a chave já vem liberada na hora).

Dá 200 buscas por hora e 20.000 por mês de graça. Não pede cartão.

**Pixabay** (opcional, mas recomendado):
1. Entre em https://pixabay.com/api/docs/ e faça login/cadastro (grátis).
2. A chave (**Your API Key**) já aparece direto no topo dessa página de
   documentação, depois de logado — não precisa criar "app" nenhum.
3. Copie a chave.

Dá um limite bem generoso (100 requisições por 60 segundos), sem cartão.

Se você já tem chaves de alguns desses bancos e não de outros, pode
configurar só as que tiver por enquanto — o sistema funciona com qualquer
combinação delas presentes, e você pode ir adicionando as outras depois.

### 2. Suba este projeto pro GitHub

1. Crie um repositório novo no GitHub (pode ser privado).
2. Suba todos os arquivos desta pasta pra ele (`git init`, `git add .`,
   `git commit -m "primeira versão"`, `git push`).

### 3. Importe no Vercel

1. Entre em https://vercel.com (login com GitHub é o mais rápido).
2. Clique em **"Add New" → "Project"**.
3. Selecione o repositório que você acabou de criar.
4. Antes de clicar em "Deploy", abra **"Environment Variables"** e adicione
   uma linha para cada chave que você tiver (pode ser só uma, duas ou as
   três):
   - Nome: `UNSPLASH_ACCESS_KEY` → Valor: a chave do Unsplash
   - Nome: `PEXELS_API_KEY` → Valor: a chave do Pexels
   - Nome: `PIXABAY_API_KEY` → Valor: a chave do Pixabay
5. Clique em **Deploy**.

Em ~1 minuto o Vercel te dá um link tipo `seu-projeto.vercel.app` — esse já
é o site funcionando, de graça (plano Hobby do Vercel).

### 4. Testar

Abra o link, escreva um tema (ex: "feira de natal", "loja de plantas",
"pop-up de perfumaria") e clique em **Gerar moodboard**. O botão
**Embaralhar fotos** troca as imagens mantendo o mesmo tema, caso a primeira
combinação não fique boa.

## Como funciona (sem IA)

O arquivo `api/moodboard.js` roda no servidor do Vercel (função serverless,
grátis até um volume generoso de uso) e faz 7 buscas fixas (Unsplash →
Pexels → Pixabay, na ordem, com fallback automático), uma pra cada "papel"
do moodboard:

1. ambiente/vitrine (foto grande, âncora do board)
2. produto/detalhe
3. textura/padrão
4. mãos em ação
5. detalhe extra
6. vitrine/produto 2
7. atmosfera geral

A busca que vai pras APIs é só o tema, traduzido pra inglês (ex: "feira de
natal" vira `"fair christmas"`) — sem nenhuma palavra extra colada. Isso é
proposital: colar um sufixo tipo "hands" ou "close up" na busca (uma
versão anterior deste arquivo fazia isso pra tentar achar plano
específico pra cada foto do board) faz o próprio buscador do Unsplash/
Pexels/Pixabay perder o foco no tema — por isso buscar só "coworking"
direto no Unsplash dá resultado ótimo, mas "coworking hands" traz
qualquer foto de mão/perna digitando que bate frouxamente com a palavra
"coworking" em algum canto da legenda.

Por isso o sistema busca o tema puro UMA VEZ, pega um pool de fotos, filtra
só as que batem com pelo menos uma palavra real do tema (isso garante que
tudo que aparece é "muito relacionado com o tema") e só DEPOIS distribui
7 fotos distintas (nunca repetidas) entre os papéis do board (ambiente,
textura, mãos, vitrine, etc.). Nenhuma etapa usa modelo de linguagem, é
tudo regra fixa (um dicionário PT→EN e comparação de palavras), sem custo
de token.

**Desempate (qual foto relevante cai em qual papel):** depois de garantir
que a foto é relevante ao tema, três critérios decidem qual foto específica
é escolhida pra cada papel, nessa ordem:
1. **Fonte**: Unsplash e Pexels sempre antes do Pixabay. O Pixabay tende a
   ter fotografia mais datada/corporativa, e tem o hábito de colocar
   dezenas de tags repetidas na mesma foto (`"office, office, office..."`),
   o que inflava artificialmente o desempate a favor dele numa versão
   anterior — por isso fotos do Unsplash não apareciam nunca, mesmo
   configurado. Agora o Pixabay só entra quando sobra papel sem foto boa o
   suficiente do Unsplash/Pexels.
2. **Estilo editorial**: um pequeno reforço pra legendas que mencionam
   interior/arquitetura/plantas/madeira/luz natural (o padrão visual das
   referências da Rachel) e um pequeno desconto pra legendas com cara de
   banco de imagens genérico ("digital nomad", "freelancer", "portrait",
   etc.) — isso não filtra nada, só desempata a favor do visual mais
   parecido com o de referência quando há mais de uma foto relevante.
3. **Tipo de plano**: um empurrão leve de palavras tipo "hands"/"texture"/
   "storefront" pra aproximar cada foto do tipo de plano do seu papel no
   grid (ambiente, textura, mãos, vitrine, etc.).

Nenhum desses três critérios conta pontos por palavra repetida (é sim/não,
no máximo 1 ponto por critério) — assim uma legenda com uma lista gigante
de tags não vence só por ter mais chance de bater em alguma palavra.

**Limite importante:** filtrar por palavra-chave garante que a foto é
sobre o tema certo, mas não garante o estilo fotográfico exato (o reforço
de estilo do item 2 ajuda, mas é uma pista textual, não visual — o sistema
não "vê" a foto, só lê a legenda/tags dela). Pra temas onde a maioria das
fotos disponíveis nos bancos gratuitos for de um estilo bem diferente do de
referência, pode sobrar pouca opção editorial e alguma foto mais genérica
ainda aparecer. Se isso acontecer bastante, o próximo passo natural seria
uma etapa de IA que descreva o estilo visual desejado antes de buscar —
mas aí entraria custo de token.

**Por que traduzir pra inglês:** os bancos de imagem são indexados
majoritariamente em inglês, e algumas palavras em português são
*ambíguas* quando usadas cru na busca. O caso que apareceu nos testes:
"natal" bate tanto com "Christmas" (o feriado) quanto com "Natal" — a
cidade litorânea do Rio Grande do Norte — e isso fazia o sistema aceitar
fotos de praia/rochedo como "relevantes" pra um moodboard de Natal, porque
a foto estava só geolocalizada/marcada com o nome da cidade. Traduzindo
"natal" → "christmas" antes de buscar e de pontuar relevância, essa
colisão de nomes desaparece (não existe cidade chamada "Christmas").

O dicionário (`PT_EN_DICT` em `api/moodboard.js`) cobre várias palavras
comuns de tema de moodboard/vitrine (natal, feira, mercado, loja, páscoa,
verão, halloween, oktoberfest, coworking, livraria, etc.). Pra palavras
que não estão no dicionário, o sistema usa a palavra em português mesmo
(ainda funciona, só que com menos garantia de bater com fotos indexadas
em inglês). Se um tema novo continuar trazendo fotos fora do assunto,
normalmente o ajuste é só acrescentar a palavra que faltou nesse
dicionário — não precisa mexer no resto do código.

Isso tem limite: pra temas muito nichados ou abstratos, ou palavras raras
sem tradução no dicionário, a busca pode não achar fotos boas (o banco de
imagens não "entende" o tema, só casa palavras-chave). Pra esses casos o
próximo passo natural é adicionar uma etapa de IA que reescreve o tema em
consultas melhores antes de buscar — aí sim entraria custo de token, mas
só quando for necessário.

## Ajustando o layout

O grid vem do mesmo template calibrado nos moodboards de referência
(arquivo `TEMPLATE_7` em `api/moodboard.js`, espelhado no front-end em
`index.html`). Pra mudar as proporções das células, edite os valores de
`left/top/width/height` (frações de 0 a 1) nos dois arquivos.

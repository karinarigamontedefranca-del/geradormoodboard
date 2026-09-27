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

Cada busca é só `"{tema} " + sufixo fixo` (ex: `"feira de natal" ambiente
interior loja`) — nenhuma etapa usa modelo de linguagem, é busca direta no
banco de imagens. Isso é rápido e sem custo, mas também tem limite: pra
temas muito nichados ou abstratos, a busca pode não achar fotos boas (o
Unsplash não "entende" o tema, só casa palavras-chave). Pra esses casos o
próximo passo natural é adicionar uma etapa de IA que reescreve o tema em
consultas melhores antes de buscar — aí sim entraria custo de token, mas
só quando for necessário.

## Ajustando o layout

O grid vem do mesmo template calibrado nos moodboards de referência
(arquivo `TEMPLATE_7` em `api/moodboard.js`, espelhado no front-end em
`index.html`). Pra mudar as proporções das células, edite os valores de
`left/top/width/height` (frações de 0 a 1) nos dois arquivos.

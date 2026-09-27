# Gerador de Moodboard — grátis, sem IA

Site com um campo de texto: você escreve um tema, ele busca 7 fotos reais no
Unsplash (banco de imagens gratuito) e monta o board no formato bento dos
moodboards de referência (a mesma grade assimétrica: 1 foto grande, colunas
divididas em cima/baixo, respiro fino entre as fotos).

Não chama nenhuma API de IA — zero tokens, zero custo. O único serviço
externo é a busca do Unsplash, que é gratuita.

## Passo a passo pra colocar no ar (uns 10 minutos)

### 1. Crie uma chave gratuita do Unsplash

1. Entre em https://unsplash.com/developers e faça login/cadastro (grátis).
2. Clique em **"New Application"** (ou "Your apps" → "New Application").
3. Aceite os termos, dê um nome qualquer pro app (ex: "Moodboard Rachel").
4. Na página do app criado, copie o **Access Key**.

Isso te dá 50 buscas por hora de graça, pra sempre — suficiente pra testar
e usar em sala de aula. Não pede cartão de crédito.

### 2. Suba este projeto pro GitHub

1. Crie um repositório novo no GitHub (pode ser privado).
2. Suba todos os arquivos desta pasta pra ele (`git init`, `git add .`,
   `git commit -m "primeira versão"`, `git push`).

### 3. Importe no Vercel

1. Entre em https://vercel.com (login com GitHub é o mais rápido).
2. Clique em **"Add New" → "Project"**.
3. Selecione o repositório que você acabou de criar.
4. Antes de clicar em "Deploy", abra **"Environment Variables"** e adicione:
   - Nome: `UNSPLASH_ACCESS_KEY`
   - Valor: a chave que você copiou no passo 1
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
grátis até um volume generoso de uso) e faz 7 buscas fixas no Unsplash,
uma pra cada "papel" do moodboard:

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

# Gerador de Moodboard — Rachel Patrocínio

Site com um campo de texto: você escreve um tema, ele busca fotos reais em
bancos de imagens gratuitos (Unsplash, Pexels e/ou Pixabay) e monta o board
no formato bento dos moodboards de referência (grade assimétrica: 1 foto
grande âncora, colunas divididas em cima/baixo, respiro fino entre as
fotos). Dá pra escolher entre 4 templates (6, 7, 8 ou 9 fotos).

O modo padrão (busca em banco de imagens) **não chama nenhuma API de IA —
zero tokens, zero custo**. Os únicos serviços externos são as buscas de
imagem, que são gratuitas.

Opcionalmente, também dá pra gerar fotos com a **API de imagens da OpenAI**
(gpt-image-1), seguindo as regras do guia de estilo da Rachel — esse modo
**tem custo real por imagem** e o site sempre pergunta antes de qualquer
chamada (veja a seção "Geração por IA" mais abaixo).

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
   três — a chave da OpenAI é opcional e separada, veja a seção "Geração
   por IA"):
   - Nome: `UNSPLASH_ACCESS_KEY` → Valor: a chave do Unsplash
   - Nome: `PEXELS_API_KEY` → Valor: a chave do Pexels
   - Nome: `PIXABAY_API_KEY` → Valor: a chave do Pixabay
   - Nome: `OPENAI_API_KEY` → Valor: sua chave da OpenAI (só se for usar a
     geração por IA)
5. Clique em **Deploy**.

Em ~1 minuto o Vercel te dá um link tipo `seu-projeto.vercel.app` — esse já
é o site funcionando, de graça (plano Hobby do Vercel).

### 4. Testar

Abra o link, escreva um tema (ex: "feira de natal", "loja de plantas",
"pop-up de perfumaria") e clique em **Gerar moodboard**. O botão
**Embaralhar fotos** troca as imagens mantendo o mesmo tema, caso a primeira
combinação não fique boa.

## Elementos específicos

No campo **"Elementos específicos"**, dá pra listar coisas pontuais que a
Rachel quer garantir que apareçam no board, separadas por vírgula — por
exemplo, pra um tema de "feira de anime": `pipoca, algodão doce`. Cada item
da lista vira a busca de UMA foto própria do board (além das fotos do tema
geral), sem interferir na busca das outras.

## Trocar uma foto específica

Depois que o board é gerado, passe o mouse sobre qualquer foto e clique em
**"Alterar imagem"**. Abre um pequeno painel com duas opções:

- **Escrever um termo de busca** (ex: "vitrine com roupas de frio") e clicar
  em **Buscar** — troca só aquela foto por uma busca nova.
- Clicar em **"Gerar outra"** sem escrever nada — sorteia outra foto
  relevante pro mesmo assunto que já estava naquela célula.
- Clicar em **"Enviar do computador"** — escolhe um arquivo de imagem do
  computador e usa ele naquela célula, sem passar por nenhum banco de
  imagens (é só um upload local no navegador, não sobe pra lugar nenhum).

Isso não regenera o board inteiro — só a célula clicada muda. E tanto o
"Buscar" quanto o "Gerar outra" nunca escolhem uma foto que já esteja em
uso em QUALQUER outra célula do mesmo board (antes disso ser corrigido,
"Gerar outra" podia trazer de volta uma foto que já estava em outra
célula).

## Templates

O menu **"Template"**, ao lado do campo de tema, tem 4 opções — todos
calibrados visualmente a partir dos moodboards de referência da Rachel:

- **6 fotos — mais amplo**: células maiores, menos fragmentado.
- **7 fotos — padrão**: o formato original (1 coluna cheia, 2 colunas
  divididas em cima/baixo, 1 coluna cheia à direita dividida).
- **8 fotos — mais fragmentado**: inclui células bem pequenas no topo.
- **9 fotos — editorial denso**: variação do 8 com uma célula extra.

Trocar de template muda quantas fotos o board tem e o formato da grade —
o resto (elementos específicos, alterar imagem, IA) funciona igual em
qualquer um deles.

### Sobre células vazias ("Sem foto relevante o bastante")

O sistema busca páginas extras de fotos automaticamente quando o tema tem
poucos resultados relevantes (isso evitava, antes, que templates maiores
como o de 8/9 fotos deixassem um canto do board sem imagem). Se mesmo assim
sobrar alguma célula vazia — tema bem nichado, poucos resultados nos bancos
de imagem — ainda dá pra clicar em **"Alterar imagem"** naquela célula e
buscar um termo mais específico, gerar outra, subir uma foto do computador
ou gerar com IA.

## Baixar o moodboard em PDF ou PPTX

Depois de gerar um board, aparecem dois botões abaixo dele: **"Baixar
PDF"** e **"Baixar PPTX"**. Os dois são montados direto no navegador (sem
passar pelo servidor): cada foto do board — do banco de imagens, gerada por
IA ou enviada do computador — é baixada e embutida no arquivo, na mesma
posição e tamanho da célula na tela, num slide 16:9 com o fundo
`#F8F1EA`. O PPTX abre pronto pra editar no PowerPoint/Google Slides; o PDF
é só pra visualizar/imprimir.

Se alguma foto de banco de imagens não puder ser baixada pelo navegador
(bloqueio de CORS raro em algum provedor), ela é só pulada e o aviso final
diz quantas ficaram de fora — o resto do arquivo sai normal.

## Geração por IA (OpenAI) — opcional, tem custo real

Além da busca gratuita em banco de imagens, dá pra gerar fotos com a API
de imagens da OpenAI (`gpt-image-1`), seguindo as regras do **Guia Mestre
de Moodboards da Rachel** (fotografia editorial realista, sem pessoas,
carga visual leve, paleta dessaturada quente, luz natural suave, sem
aparência de IA) — o prompt que vai pra API já embute essas regras.

**Isso custa dinheiro de verdade** na conta da OpenAI, então:

- Requer a variável de ambiente `OPENAI_API_KEY` configurada no Vercel
  (veja o passo 3 acima). Sem ela, o site avisa que a geração por IA não
  está disponível, mas a busca normal continua funcionando de boa.
- **O site SEMPRE pergunta antes de qualquer chamada** — uma caixa de
  confirmação nativa do navegador aparece toda vez, tanto pra gerar o
  board inteiro quanto pra gerar 1 foto só, avisando quantas chamadas
  (= quanto custo) aquilo vai gerar. Nada é gerado sem essa confirmação.

Duas formas de usar:

1. **Botão "Gerar moodboard inteiro com IA"** (abaixo do formulário): gera
   uma foto por IA pra cada papel do template escolhido, uma de cada vez
   (não em paralelo), preenchendo o board célula por célula. Antes,
   gere o board normal (banco de imagens) pelo menos uma vez com esse
   mesmo template, pra carregar o layout da grade.
2. **Botão "Gerar com IA"** dentro do painel "Alterar imagem" de uma
   célula: gera só aquela foto.

Em ambos os casos, o campo de texto (na célula) ou **"Instrução extra pra
IA"** (no formulário principal) deixam você especificar exatamente o que
quer na imagem — por exemplo "uma vitrine com casacos de lã" ou "usar tons
mais rosé" — sem precisar reescrever o prompt inteiro.

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

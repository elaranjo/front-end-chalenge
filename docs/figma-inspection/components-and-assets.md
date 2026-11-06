# Componentes e assets do Figma

As referências abaixo pertencem ao arquivo original exportado em 5 de novembro de 2026. Os componentes principais, suas instâncias e overrides estão preservados em [source-nodes.json](data/source-nodes.json); a lista de definições está em [components.json](data/components.json). O arquivo tem 36 símbolos/componentes e dois conjuntos de variantes serializados, totalizando 38 entradas neste inventário. A página interna de recursos não é uma tela adicional do produto.

## Instruções documentadas nos componentes

| Componente | ID | Instrução presente no arquivo e implicação para a entrega |
| --- | --- | --- |
| Social Button | `70483:263` | Variantes Provider=Google/Facebook escolhem marca e texto. Largura FILL. O pai controla o recuo: 80 no modal desktop e 0 no bloco mobile. Não define implementação OAuth real. |
| Filters | `70485:381` | Largura fixa 310; checkboxes de coleção com contagens, faixa de preço com Aplicar e checkboxes de rede. Conteúdo igual nas instâncias, sem overrides por tela esperados. Isso confirma seleção combinável. |
| Header Row | `70486:560` | Largura 1200, FILL no host e HUG na altura. Início ativo em home/login/cadastro/perfil/carteiras; Mercado ativo no fluxo detalhe/carrinho/pagamento/confirmação. Badge Count representa contagem de itens do carrinho. Inserido no início de Top/Header. A linha inferior pertence ao host. |
| Header With Divider | `70504:3017` | Header com divisor na home, perfil, carteiras e no Marketplace Page que aparece atrás dos dois modais de autenticação. As telas do fluxo Mercado usam Header Row sem divisor. A diferença é intencional. |
| Footer | `70491:1286` | Largura 1200, FILL/HUG, último filho da tela quando usado; abaixo do scrim na ordem de pintura. Três medalhões, newsletter, faixa de marca/contato e quatro colunas. Conteúdo igual entre instâncias. |
| Password Input | `70504:2973` | Campo com borda e toggle de visibilidade usado na alteração de senha. A descrição informa que não tem filho de texto e orienta adicionar texto/propriedade sem destacar a instância ao editar o Figma. Na aplicação, deve continuar sendo um input de senha funcional. |
| Mobile Social Block | `70504:2994` | Divisor e botões Google/Facebook. O desktop tem espaçamento diferente e intencionalmente não usa esse mesmo bloco. |
| Checkout Page | `70504:3190` | Conteúdo compartilhado por pagamento e fundo da confirmação. Seus Arrow-Down dependem do componente local `9:1589`, que está dentro do ENS Input do perfil. Essa é uma dependência do arquivo de design, não uma dependência de rotas na aplicação. |
| Marketplace Page | `70504:3297` | Fundo compartilhado por login/cadastro. A descrição declara defeitos ainda congelados: preço órfão duplicado “2.29 ETH” sobre um card e badge RARO quadrado ultrapassando o canto arredondado. Não há autorização nessa descrição para corrigi-los durante uma reprodução literal. |

Essas instruções são diferentes dos comentários de visitantes. Não foi encontrada documentação de duração de carrossel, animação de modal, gesto de arrastar, menus de ordenação, estratégia de rolagem ou destinos do botão central mobile. As conexões de protótipo dos 15 frames têm contagem zero.

## Imagens raster

O `.fig` contém **quatro imagens originais**, todas PNG **1254 × 1254**, preservadas em `assets/`. Não foram geradas novas imagens nem usadas imagens semelhantes. Elas são reutilizadas para vários NFTs, heros, miniaturas, banners, cards editoriais e linhas de carrinho/recibo.

| Arquivo local | Conteúdo visual conferido | Uso reconhecível |
| --- | --- | --- |
| [8459204731e6eba9d474cbc8ebc37071360d3ba5.png](assets/8459204731e6eba9d474cbc8ebc37071360d3ba5.png) | Macaco de óculos redondos, corrente e jaqueta verde | Hero principal, Emerald Ape e galeria do detalhe |
| [2986a7cb16d09de8970824d2dd58bf0bb021702c.png](assets/2986a7cb16d09de8970824d2dd58bf0bb021702c.png) | Macaco cinza de chapéu e moletom roxo | Sage Nomad, Cosmic Bloom, Violet Nomad e destaque lateral |
| [9df2ff42dd27ba657621c304557d1a855a4be6a5.png](assets/9df2ff42dd27ba657621c304557d1a855a4be6a5.png) | Macaco escuro de brinco, gola verde e blazer claro | Neon Vessel/Ivory Baron e cards relacionados |
| [87580f2def9af0ce13f4b6f6ce17bb2449bcfc16.png](assets/87580f2def9af0ce13f4b6f6ce17bb2449bcfc16.png) | Macaco dourado de fones verdes e jaqueta clara | Golden Beat/Golden Signal e outros cards |

O [manifesto](data/raster-assets.json) contém tamanho e SHA-256 de cada arquivo. O [mapa de referências](data/image-references.json) registra os slots diretos e overrides, tamanho do nó, modo de preenchimento e transform. Vários slots usam FILL e recortes próprios; usar apenas o PNG correto sem reproduzir o enquadramento não basta. Os nomes dos NFTs não são uma chave confiável para escolher a imagem em todos os frames, pois há conflitos documentados.

## Vetores e marcas

Os ícones são predominantemente **Iconly**, com variantes Curved, Bold, Two-tone e Light-Outline. Há também User, Shop, Search, Message, Arrow-Down e X locais; logotipos Google/Facebook; ícones sociais do footer; desenho de envelope “THANK YOU”; forma da tab bar e do ícone central; estrelas; círculos e gradientes decorativos. W/M nos provedores e W/C/D nos medalhões do footer são letras desenhadas, não placeholders que possam ser substituídos automaticamente.

As definições vetoriais permanecem no `.fig`. Não foi completada uma exportação individual de todos os SVGs nesta inspeção; não se afirma que já estejam prontos para importar no React. O limite do conector não autoriza substituição por Lucide/Font Awesome ou redesenho aproximado. O inventário permite localizar cada definição no arquivo e exportá-la pela interface na etapa de implementação.

## Fontes e estilos

A variável `font/family` (`70320:302`) vale **Roboto Mono** e a descrição a identifica como fonte principal. Os estilos de texto incluem Regular, Medium, Bold, SemiBold, Light e Thin, em tamanhos de 9 a 43. Os arquivos de fonte não estão embutidos como TTF/WOFF nos assets exportados e ainda precisarão ser disponibilizados localmente na implementação.

Há oito registros antigos de texto com fontName Inter / Semi Bold nos títulos e links dos cards editoriais. **Isso não comprova uso efetivo de Inter.** A inspeção do nó `70343:262` no painel Properties do original mostrou fonte vinculada a `font/family`, estilo Bold, peso 700, tamanho 16 e entrelinha 100%. Portanto, os vínculos de estilo/variável devem prevalecer sobre atributos antigos do binário. [Registro dessa conferência](data/typography-verification.json).

Também há nomes e descrições desatualizados de estilos: por exemplo, o nome “Title/20 Regular · lh 10” não representa a entrelinha atual de 28 no estilo. Cor e tipografia devem ser resolvidas pelas propriedades atuais no inspetor, não inferidas pelo nome. O JSON é evidência de autoria e vínculos, não um motor de resolução de estilos do Figma.

### Estilos de texto declarados

| ID | Nome | Família e estilo declarados | Tamanho | Entrelinha declarada |
| --- | --- | --- | --- | --- |
| `70321:301` | Display/43 Bold | Roboto Mono / Bold | 43 | 70 PIXELS |
| `70321:302` | Display/32 Bold | Roboto Mono / Bold | 32 | 100 PERCENT |
| `70321:303` | Heading/30 Bold | Roboto Mono / Bold | 30 | 16 PIXELS |
| `70321:304` | Heading/28 Bold | Roboto Mono / Bold | 28 | 100 PERCENT |
| `70321:305` | Heading/28 Regular | Roboto Mono / Regular | 28 | 16 PIXELS |
| `70321:306` | Heading/26 Bold | Roboto Mono / Bold | 26 | 32 PIXELS |
| `70321:307` | Heading/24 Bold | Roboto Mono / Bold | 24 | 100 PERCENT |
| `70321:308` | Heading/24 SemiBold | Roboto Mono / SemiBold | 24 | 100 PERCENT |
| `70321:309` | Title/23 Bold | Roboto Mono / Bold | 23 | 16 PIXELS |
| `70321:310` | Title/22 Bold | Roboto Mono / Bold | 22 | 16 PIXELS |
| `70321:311` | Title/22 Regular | Roboto Mono / Regular | 22 | 29 PIXELS |
| `70321:312` | Title/21 Regular | Roboto Mono / Regular | 21 | 16 PIXELS |
| `70321:313` | Title/20 Bold · lh 26 | Roboto Mono / Bold | 20 | 26 PIXELS |
| `70321:314` | Title/20 Regular · lh 10 | Roboto Mono / Regular | 20 | 28 PIXELS |
| `70321:315` | Title/20 Regular · lh 16 | Roboto Mono / Regular | 20 | 16 PIXELS |
| `70321:316` | Title/20 Medium | Roboto Mono / Medium | 20 | 16 PIXELS |
| `70321:317` | Title/20 Bold · lh 16 | Roboto Mono / Bold | 20 | 16 PIXELS |
| `70321:318` | Body Large/19 Bold | Roboto Mono / Bold | 19 | 29 PIXELS |
| `70321:319` | Body Large/18 Bold · lh 16 | Roboto Mono / Bold | 18 | 16 PIXELS |
| `70321:320` | Body Large/18 Regular | Roboto Mono / Regular | 18 | 16 PIXELS |
| `70321:321` | Body Large/18 Light | Roboto Mono / Light | 18 | 16 PIXELS |
| `70321:322` | Body Large/18 Bold · lh 24 | Roboto Mono / Bold | 18 | 24 PIXELS |
| `70321:323` | Body Large/18 Thin | Roboto Mono / Thin | 18 | 16 PIXELS |
| `70321:324` | Body Large/18 Medium | Roboto Mono / Medium | 18 | 25 PIXELS |
| `70321:325` | Body Large/17 Bold | Roboto Mono / Bold | 17 | 16 PIXELS |
| `70321:326` | Body Large/17 Regular · lh 16 | Roboto Mono / Regular | 17 | 16 PIXELS |
| `70321:327` | Body Large/17 Regular · lh 10 | Roboto Mono / Regular | 17 | 24 PIXELS |
| `70321:328` | Body Large/16 Bold · lh auto | Roboto Mono / Bold | 16 | 100 PERCENT |
| `70321:329` | Body Large/16 Regular · lh auto | Roboto Mono / Regular | 16 | 100 PERCENT |
| `70321:330` | Body Large/16 Medium · lh auto | Roboto Mono / Medium | 16 | 100 PERCENT |
| `70321:331` | Body Large/16 Bold · lh 20 | Roboto Mono / Bold | 16 | 20 PIXELS |
| `70321:332` | Body Large/16 Regular · lh 16 | Roboto Mono / Regular | 16 | 16 PIXELS |
| `70321:333` | Body Large/16 Medium · lh 16 | Roboto Mono / Medium | 16 | 16 PIXELS |
| `70321:334` | Body Large/16 Bold · lh 16 | Roboto Mono / Bold | 16 | 16 PIXELS |
| `70321:335` | Body Large/16 Regular · lh 10 | Roboto Mono / Regular | 16 | 22 PIXELS |
| `70321:336` | Body/15 Medium | Roboto Mono / Medium | 15 | 16 PIXELS |
| `70321:337` | Body/15 Regular · lh 16 | Roboto Mono / Regular | 15 | 100 PERCENT |
| `70321:338` | Body/15 Regular · lh 40 | Roboto Mono / Regular | 15 | 40 PIXELS |
| `70321:339` | Body/15 Bold · lh 40 | Roboto Mono / Bold | 15 | 40 PIXELS |
| `70321:340` | Body/15 Bold · lh 16 | Roboto Mono / Bold | 15 | 16 PIXELS |
| `70321:341` | Body/15 Regular · lh 15 | Roboto Mono / Regular | 15 | 15 PIXELS |
| `70321:342` | Body/15 Regular · lh 45 | Roboto Mono / Regular | 15 | 45 PIXELS |
| `70321:343` | Body/15 Bold · lh 15 | Roboto Mono / Bold | 15 | 15 PIXELS |
| `70321:344` | Body/14 Bold · lh auto | Roboto Mono / Bold | 14 | 100 PERCENT |
| `70321:345` | Body/14 Medium · lh 16 | Roboto Mono / Medium | 14 | 16 PIXELS |
| `70321:346` | Body/14 Regular · lh 24 | Roboto Mono / Regular | 14 | 24 PIXELS |
| `70321:347` | Body/14 Medium · lh 16 · ls 0% | Roboto Mono / Medium | 14 | 16 PIXELS |
| `70321:348` | Body/14 Regular · lh 22 | Roboto Mono / Regular | 14 | 22 PIXELS |
| `70321:349` | Body/14 Medium · lh 20 | Roboto Mono / Medium | 14 | 20 PIXELS |
| `70321:350` | Body/14 Regular · lh 30 | Roboto Mono / Regular | 14 | 30 PIXELS |
| `70321:351` | Body/14 Regular · lh 16 | Roboto Mono / Regular | 14 | 16 PIXELS |
| `70321:352` | Body/14 Bold · lh 24 | Roboto Mono / Bold | 14 | 24 PIXELS |
| `70321:353` | Body/14 Bold · lh 20 | Roboto Mono / Bold | 14 | 20 PIXELS |
| `70321:354` | Body/14 Bold · lh 16 | Roboto Mono / Bold | 14 | 16 PIXELS |
| `70321:355` | Body/14 Regular · lh 15 | Roboto Mono / Regular | 14 | 15 PIXELS |
| `70321:356` | Body/14 Bold · lh auto · ls 0% | Roboto Mono / Bold | 14 | 100 PERCENT |
| `70321:357` | Body/14 SemiBold | Roboto Mono / SemiBold | 14 | 100 PERCENT |
| `70321:358` | Caption/13 Regular · lh 22 | Roboto Mono / Regular | 13 | 22 PIXELS |
| `70321:359` | Caption/13 Regular · lh 16 | Roboto Mono / Regular | 13 | 16 PIXELS |
| `70321:360` | Caption/13 Medium | Roboto Mono / Medium | 13 | 16 PIXELS |
| `70321:361` | Caption/13 Regular · lh auto | Roboto Mono / Regular | 13 | 100 PERCENT |
| `70321:362` | Caption/12 Regular · lh 16 | Roboto Mono / Regular | 12 | 16 PIXELS |
| `70321:363` | Caption/12 Regular · lh 18 | Roboto Mono / Regular | 12 | 18 PIXELS |
| `70321:364` | Caption/12 Bold | Roboto Mono / Bold | 12 | 14 PIXELS |
| `70321:365` | Tiny/11 Medium | Roboto Mono / Medium | 11 | 16 PIXELS |
| `70321:366` | Tiny/10 Medium | Roboto Mono / Medium | 10 | 100 PERCENT |
| `70321:367` | Tiny/9 Bold | Roboto Mono / Bold | 9 | 100 PERCENT |

### Cores das variáveis

A tabela registra os valores declarados no snapshot, incluindo a coleção legada Cores / Café. Há nomes duplicados/legados e distinção entre `Color/Foreground` (#F5F1EB) e `Text/Primary` (#F7F3EC). Não se deve substituir todos os tons próximos por uma única cor. Gradientes, opacidades e fills por camada continuam nos dados de origem.

| Variável | Valor | ID |
| --- | --- | --- |
| bg/default | `#140D0A` | `70306:303` |
| surface/2 | `#241612` | `70306:305` |
| surface/3 | `#2F1D15` | `70306:306` |
| border/default | `#3F2319` | `70306:307` |
| border/strong | `#55321F` | `70306:308` |
| text/primary | `#F7F3EC` | `70306:309` |
| text/secondary | `#CFB28C` | `70306:310` |
| text/muted | `#B0916A` | `70306:311` |
| accent/default | `#D28A4C` | `70306:312` |
| functional/danger | `#F0805F` | `70308:302` |
| functional/rating | `#E3A44E` | `70308:303` |
| color/primary | `#D28A4C` | `70320:303` |
| color/primary-light | `#DD9A5F` | `70320:304` |
| color/primary-dark | `#C47B3E` | `70320:305` |
| color/amber | `#E3A44E` | `70320:306` |
| color/text-coral | `#F0805F` | `70320:307` |
| color/foreground | `#F5F1EB` | `70320:308` |
| color/background-elevated | `#FBFBFB` | `70320:309` |
| color/white | `#FFFFFF` | `70320:310` |
| color/black | `#000000` | `70320:311` |
| color/secondary | `#B39463` | `70320:312` |
| color/text-muted | `#B0916A` | `70320:313` |
| color/surface-card | `#241612` | `70320:314` |
| color/surface-raised | `#2F1D15` | `70320:315` |
| color/ink | `#140D0A` | `70320:316` |
| color/ink-deep | `#0E0907` | `70320:317` |
| color/ink-soft | `#1C110C` | `70320:318` |
| color/surface-dark | `#38220F` | `70320:319` |
| color/border | `#3F2319` | `70320:320` |
| color/border-soft | `#55321F` | `70320:321` |
| color/gray-light | `#EDEDED` | `70320:322` |
| color/success | `#00A66C` | `70320:323` |
| color/error | `#ED1B2E` | `70320:324` |
| logo/orange | `#FF641A` | `70320:325` |
| logo/facebook | `#3B5999` | `70320:326` |
| logo/google-blue | `#4086F4` | `70320:327` |
| logo/google-green | `#59C36A` | `70320:328` |
| logo/google-yellow | `#FFDA2D` | `70320:329` |
| logo/blue | `#4175DF` | `70320:330` |
| logo/light-blue | `#03A9F4` | `70320:331` |
| logo/indigo | `#283593` | `70320:332` |
| color/text-primary | `#F7F3EC` | `70330:301` |
| color/text-secondary | `#CFB28C` | `70330:302` |
| color/text-accent | `#E89B55` | `70330:303` |
| text/accent | `#E89B55` | `70335:301` |

## Inventário completo de componentes e conjuntos

| ID | Nome | Dimensão da definição | Tipo |
| --- | --- | --- | --- |
| `2:36` | Iconly/Curved/Logout | 24 × 24 | SYMBOL |
| `4:149` | Iconly/Two-tone/Arrow - Down 2 | 24 × 24 | SYMBOL |
| `4:153` | Iconly/Two-tone/Arrow - Down 2 | 24 × 24 | SYMBOL |
| `4:393` | Iconly/Curved/Arrow - Right 2 | 24 × 24 | SYMBOL |
| `5:100` | Iconly/Curved/Arrow - Right | 24 × 24 | SYMBOL |
| `9:947` | X | 18 × 18 | SYMBOL |
| `9:964` | Iconly/Curved/Hide | 24 × 24 | SYMBOL |
| `9:1443` | User | 18 × 18 | SYMBOL |
| `9:1467` | Iconly/Curved/Activity | 24 × 24 | SYMBOL |
| `9:1477` | Iconly/Curved/Download | 24 × 24 | SYMBOL |
| `9:1487` | Iconly/Curved/Danger Triangle | 24 × 24 | SYMBOL |
| `9:1550` | Iconly/Curved/Image 2 | 24 × 24 | SYMBOL |
| `9:1589` | Arrow-Down | 20 × 20 | SYMBOL |
| `9:1592` | Iconly/Light-Outline/Hide | 24 × 24 | SYMBOL |
| `9:1651` | Iconly/Light-Outline/Location | 24 × 24 | SYMBOL |
| `11:1192` | Iconly/Bold/Star | 24 × 24 | SYMBOL |
| `11:1248` | Message | 18 × 18 | SYMBOL |
| `11:2030` | Iconly/Curved/Delete | 24 × 24 | SYMBOL |
| `15:5313` | Iconly/Curved/Filter | 24 × 24 | SYMBOL |
| `15:5331` | Search | 22 × 22 | SYMBOL |
| `15:5516` | Iconly/Bold/Home | 24 × 24 | SYMBOL |
| `15:5522` | User | 20 × 20 | SYMBOL |
| `15:5524` | Shop | 20 × 20 | SYMBOL |
| `15:5746` | Iconly/Curved/Arrow - Left 2 | 24 × 24 | SYMBOL |
| `23:1373` | Iconly/Curved/Wallet | 24 × 24 | SYMBOL |
| `70483:256` | Provider=Google | 340 × 40 | SYMBOL |
| `70483:262` | Provider=Facebook | 340 × 40 | SYMBOL |
| `70483:263` | Social Button | 380 × 160 | FRAME |
| `70485:381` | Filters | 310 × 785 | SYMBOL |
| `70486:529` | Active=Home | 1200.001 × 46.0 | SYMBOL |
| `70486:555` | Active=Market | 1200.001 × 46.0 | SYMBOL |
| `70486:560` | Header Row | 1240.001 × 172 | FRAME |
| `70491:1286` | Footer | 1200 × 610 | SYMBOL |
| `70504:2973` | Password Input | 417 × 40 | SYMBOL |
| `70504:2994` | Mobile Social Block | 358 × 124 | SYMBOL |
| `70504:3017` | Header With Divider | 1200.001 × 46.0 | SYMBOL |
| `70504:3190` | Checkout Page | 1200 × 900 | SYMBOL |
| `70504:3297` | Marketplace Page | 1206 × 1958 | SYMBOL |

Não existe uma biblioteca completa de estados de todos os controles. Cards, steppers, selects, formulário de carteira secundária, drawer de filtros, feedbacks de API e estados de pedido ainda exigem especificação de adaptação coerente com os componentes presentes.

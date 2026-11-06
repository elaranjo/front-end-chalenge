# Referências visuais e adaptações

Fonte congelada: `docs/figma-inspection/source/frontend-challenge.fig`, SHA256 `7017e04fa195974ae22a27c78dc88413eb5292a849bf4defbe295062813e0dbd`. Medidas/detalhes em `frames.md`, `layer-inventory.md`, `data/frame-*.json` e propriedades verificadas. A inspeção deve preceder o código de cada tela; a comparação visual deve acompanhar a implementação e a aceitação final.

## Quinze referências obrigatórias

| ID visual | Frame | Dimensão | Rota/estado | Preparação e particularidades |
| --- | --- | --- | --- | --- |
| F01 | 2:2 | 1440×3668 | `/` | visual-desktop, home, hero próprio, sidebar310/grid842, divisor, promos/blog/footer. |
| F02 | 10:244 | 1440×2246 | `/nfts/emerald-ape-042` | Edição1/50, qty1, arte verde, galeria, abas, relacionados, footer. |
| F03 | 11:1278 | 1440×1754 | `/cart` | Seed desktop2/6/9, subtotal26.83/taxa0.016/total26.846, tokens corrigidos, badge17. |
| F04 | 11:2862 | 1440×1657 | `/checkout` | Autenticado, mesmo cart, campos seed, Coinbase selecionada e conexão simulada. |
| F05 | 11:4385 | 1440×1657 | `/orders/:id` confirmed | Snapshot determinístico; modal578×821 em431/166, BG#140D0A .6; carteira/rede reais da fixture do pedido, não constantes divergentes. |
| F06 | 9:115 | 1440×1981 | `/login` | Modal500×600 em470/160, sem fill no BG, catálogo congelado, inset social80. |
| F07 | 9:1022 | 1440×1981 | `/signup` | Modal500×656 em470/158, mesmas regras de fundo; Criar conta. |
| F08 | 9:1238 | 1440×1080 | `/profile` | Usuário autenticado, sidebar ativo, sem footer, senha vazia, inputs417×40. |
| F09 | 9:1670 | 1440×1080 | `/wallets` | Principal em formulário, secundária vazia; sem footer. |
| F10 | 14:5226 | 414×896 | `/` | visual-mobile, recuo24, hero366×190 próprio, grid175/16 com coluna+32, Tab Bar414×126. |
| F11 | 15:5536 | 414×896 | `/nfts/emerald-ape-042` | Sobreposição-114, hero414×506/sheet414×504/buybar414×164; chip1/1 corrigido. |
| F12 | 16:360 | 414×896 | `/cart` | Seed mobile1/1/2/2, subtotal8.14/total8.156, remover em todos os cards, qtymín1. |
| F13 | 16:748 | 414×896 | `/checkout` passo2 | Carteira Reserva Polygon, Coinbase, total8.156; Revisar acessível para dados/itens/taxas do passo1. |
| F14 | 16:1022 | 414×896 | `/login` | Página integral, padding80/28/24, social358×124; sem catálogo atrás. |
| F15 | 16:1228 | 414×896 | `/signup` | Mesmo padding, username centralizado, toggles nas duas senhas, Criar perfil. |

Os IDs/posições de todas as instâncias constam no inventário. Dimensões fracionárias exportadas são preservadas no JSON e só arredondadas aqui para leitura. Não alterar a geometria para uniformizar diferenças reais.

## Tokens e assets

Família Roboto Mono conforme binding `font/family` e `typography-verification.json`; títulos editoriais antes descritos como Inter foram verificados como Roboto Mono Bold16/100%. Fundo#140D0A, superfície#241612, elevada#2F1D15, primário#D28A4C; foreground#F5F1EB e text-primary#F7F3EC são distintos. Os demais tokens, gradientes, opacidades, raios e medidas vêm dos dados de estilos, não dessa lista abreviada.

Usar quatro PNGs originais (hash no nome) com crops e slots verificados. Exportar vetores de logo, ícones, providers, envelope e decorações como SVG sem redesenhar. Adquirir Roboto Mono nos pesos usados e licença para entrega local. Manifest de assets deve relacionar origem/node, arquivo, hash, dimensões e uso; nenhuma imagem gerada, emoji ou ícone parecido substitui asset existente. Derivados de otimização só podem preservar arte/crop e ter origem/hashes registrados. Captura de tela de um frame nunca vira imagem de fundo da aplicação.

## Critério de comparação

Antes de cada tela: exportar/capturar referência limpa sem seleção, conferir propriedades resolvidas e adquirir assets. Depois: renderizar mesma largura, estado, zoom100%, DPR1 e fontes carregadas; comparar overlay/diff e medidas. Para páginas desktop comparar full-page com altura original; para mobile guardar crop414×896 e também full-page para provar que o conteúdo continua acessível. Guardar referência original, captura do app e diff integral.

Aceitar somente diferenças previamente localizadas de dados C01–C10, estados obrigatórios ausentes e acessibilidade. Manifest por frame registra node/região, motivo, valor original e esperado; não há máscara genérica para números, imagens ou header. Geometria/tipografia/cores/gradientes/assets devem coincidir com a referência resolvida; diferença de rasterização de glifos só é aceita se registrada e se métricas/fontes/pesos estiverem corretos. Não usar percentual global de pixels como licença para divergência. Baseline do app é aprovada somente após essa comparação independente.

V06 é conferência de valor atual, não liberdade para inventar overlay. V08 preserva os defeitos congelados apenas no fundo composto; o catálogo funcional mantém identidade consistente C04. Se a fonte/propriedade/asset não puder ser verificada, registrar gate visual bloqueado e não declarar pixel perfect.

## Estados derivados e responsividade

390 conserva recuos24 na home e28 em formulários/cart, com larguras fluidas; não escala fontes globalmente. Tablet aplica L01; desktop1280 conserva conteúdo máximo1200 e reduz recuos disponíveis, alcançando120 em1440. Mobile perfil/carteiras/recibo e favoritos usam as composições explicitadas nas decisões; não são chamados de cópias pixel perfect de frames inexistentes.

Skeletons, validações, conexão, pendência, recusa, cotação alterada, menu de filtros/ordenação, busca aberta e galerias reutilizam superfícies/bordas/tipografia existentes. Conteúdo adicional ocupa fluxo rolável e não encobre CTA/erros. Footer aparece onde existe no frame, não é acrescentado a perfil/carteiras/mobile por convenção. Promoções/editorial da home desktop permanecem, mesmo com suas páginas de destino fora do escopo.

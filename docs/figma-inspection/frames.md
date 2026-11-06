# Inspeção dos quinze frames

Todas as medidas abaixo são pixels de design, não o tamanho do canvas na captura do navegador. Cada título aponta para o frame original. O [inventário de camadas](layer-inventory.md) registra as posições e dimensões intermediárias; `data/frame-<id>.json` relaciona os nós e componentes de cada tela.

## 1. Desktop Início

[Frame `2:2`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=2-2) — **1440 × 3668**.

Auto layout vertical, padding superior/inferior de 24 e laterais de 120, intervalo de 96 entre grandes seções. Conteúdo central de 1200. Fundo `#140D0A`.

| Bloco | Referência | Medidas e composição |
| --- | --- | --- |
| Top | `70353:242` | 1200 × 527; intervalo de 32 entre cabeçalho e hero |
| Cabeçalho | `70522:3240` | Instância de Header With Divider; KURIO, quatro links, busca, carrinho com badge e Entrar; Início ativo |
| Hero | `70347:239` | 1200 × 450; texto à esquerda, arte do macaco com óculos e jaqueta verde à direita; três indicadores |
| Products | `70342:2831` | 1200 × 1373; sidebar de 310, intervalo horizontal de 48 e grid de 842 |
| Sidebar | `70410:3725` | Filtros de 310 × 785 e banner de destaque de 310 × 470, separados por 24 |
| Grid | `70342:2830` | Abas, ordenação, três colunas, três fileiras e paginação inferior |
| Promos | `70353:241` | Dois cards de 586 × 250, separados por 28 |
| Blog | `70343:253` | 1200 × 476; título, subtítulo e quatro cards de 268 × 369 |
| Footer | `70492:696` | Instância de 1200 × 610 |

O hero diz “Bem-vindo à Kurio”, “SEJA DONO DO FUTURO / DA ARTE DIGITAL”, tem texto de apoio e CTA “EXPLORAR”. O título usa Roboto Mono Bold, 43, entrelinha de 70; o apoio, 14 com entrelinha de 24.

O filtro lista, nesta ordem, Arte digital (33), Fotografia (12), Música (65), Arte 3D (39), Colecionáveis (23), Generativa (17), Jogos (19), Assinaturas (13), Utilidade (18). A faixa mostra `0,02 - 12,30 ETH`, slider com dois limites e Aplicar. Redes: Ethereum (119), Polygon (78), Solana (86). A descrição do componente define os itens como checkboxes, apesar da apresentação discreta no desenho.

As abas são Todos os NFTs, Novos lançamentos e Em alta. A ordenação fechada mostra “Listados recentemente”. A paginação desenha 1, 2, 3, 4 e seta para a direita. Não há desenho do menu aberto, busca expandida ou página 2.

Cards visíveis incluem Emerald Ape #042 (1.19), Sage Nomad #009 (1.69), Neon Vessel #552 (1.99 com 2.29 anterior), Cosmic Bloom #118 (1.29), Violet Nomad #314 (1.39), Ivory Baron #088 (1.79), Golden Beat #207 (0.99) e Golden Signal #160 (0.39). A terceira fileira contém uma posição sem o mesmo conjunto de nome/preço das demais. As fileiras e imagens não são perfeitamente uniformes; o desenho precisa ser comparado por camada, sem impor um grid genérico.

Os cards editoriais e o footer pertencem à composição da home. O README exclui a implementação de páginas editoriais, não autoriza retirar essas seções da home. Newsletter e links auxiliares não têm sucesso funcional especificado.

## 2. Desktop Detalhes do NFT

[Frame `10:244`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=10-244) — **1440 × 2246**.

Padding 24/120/24/120, intervalo de 96 e conteúdo de 1200. Blocos Top (1200 × 553), Description (1200 × 340), Related Products (1200 × 407) e Footer (1200 × 610). O cabeçalho usa Mercado ativo e não tem a linha divisória do cabeçalho da home.

O breadcrumb é Início / Mercado. A seção Product (`70342:2764`) mede 1200 × 448, com intervalo de 32. Galeria à esquerda: quatro miniaturas verticais repetindo a arte verde, imagem principal maior e ícone de lupa. À direita: Emerald Ape #042, 1.19 ETH, estrelas, 19 avaliações, descrição, seletor de edição, stepper de quantidade, COMPRAR e Favoritar.

Edições desenhadas: **1/1, 1/10, 1/50 e ABERTA**, com 1/50 destacado. Quantidade inicial 1. Metadados: token #0042, coleção Kurio Apes e atributos Óculos, Esmeralda, Raro. Há compartilhamento por LinkedIn, e-mail e Twitter.

Abaixo aparecem as abas Detalhes do NFT e Avaliações de colecionadores (19). Só o conteúdo de detalhes está desenhado. Inclui texto sobre a obra, rede Ethereum/IPFS, contrato e direitos autorais; alguns rótulos não correspondem semanticamente ao texto seguinte. Os direitos do criador citam 5%, mas isso é conteúdo informativo, não requisito de cálculo de royalties reais.

“Mais desta coleção” tem cinco cards e três indicadores. Não há desenho de zoom aberto, aba de avaliações, favoritos ativos, edição indisponível, carregamento, erro ou NFT inexistente.

## 3. Desktop Carrinho de NFTs

[Frame `11:1278`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=11-1278) — **1440 × 1754**.

Padding 24/120/24/120 e intervalo de 96. Top de 1200 × 493; conteúdo de carrinho de 1200 × 416. Cabeçalho Mercado, breadcrumb Início / Mercado / Carrinho. Corpo em duas colunas: tabela de itens e resumo.

Tabela com NFTs, Preço, Edições e Total. Neste contexto, “Edições” contém o **stepper de quantidade**, não um novo seletor de modalidade da edição. Cada linha possui miniatura, nome, token, preço unitário, quantidade, total e lixeira.

| Item desenhado | Token mostrado | Preço unitário | Quantidade | Linha |
| --- | --- | --- | --- | --- |
| Emerald Ape #042 | #0042 | 1.19 | 2 | 2.38 ETH |
| Violet Nomad #314 | #0009 | 1.39 | 6 | 8.34 ETH |
| Ivory Baron #088 | #0552 | 1.79 | 9 | 16.11 ETH |

O resumo diz “Resumo da carteira”. Há campo Código promocional e Aplicar, subtotal **26.83**, desconto `(-) 00.00`, taxa **0.016**, anotação Taxa estimada e total **26.846 ETH**. CTA Conectar e finalizar e link Continuar explorando. Os cálculos desta versão são coerentes; os IDs dos dois últimos itens divergem do checkout e recibo.

“Colecionadores também viram” exibe cinco cards e três indicadores; depois, o footer. Sem desenho de carrinho vazio, remoção confirmada, cupom aplicado/removido, indisponibilidade ou alteração em tempo real.

## 4. Desktop Pagamento

[Frame `11:2862`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=11-2862) — **1440 × 1657**.

Padding 24/120/24/120 e intervalo de 96. Usa uma instância Checkout Page (`70522:3321`, cerca de 1200 × 903) e Footer. O componente principal é `70504:3190`. Cabeçalho Mercado e breadcrumb Início / Mercado / Pagamento.

À esquerda fica Perfil do colecionador, com formulário em duas colunas. Os campos desenhados são:

- Nome de exibição, Nome de usuário, Rede e Nome do perfil;
- Endereço da carteira e ENS ou carteira secundária (opcional);
- Tipo de carteira, Código de indicação, E-mail e Nome ENS com seletor `.eth`;
- controle Usar outra carteira? e Observação do colecionador (opcional), em textarea.

Os campos, exceto os explicitamente opcionais, possuem asteriscos. Os controles Rede, Tipo de carteira e sufixo ENS estão fechados; suas listas de opções não foram desenhadas.

À direita, “Seus NFTs” mostra três itens, quantidades 2/6/9 e subtotais iguais aos do carrinho desktop, mas com tokens #0042, #0314 e #0088. Há chamada para aplicar cupom, subtotal, desconto, taxa e total. “Carteira e rede” contém três radios: a primeira linha apresenta um chip com **METAMASK · WALLETCONNECT · COINBASE**, seguida por MetaMask e Coinbase Wallet. Coinbase está selecionada. A primeira linha não tem a identificação inequívoca WalletConnect vista no mobile.

O botão final é Confirmar compra. Não há frame de revisão separado, conexão recusada, rede incompatível, cotação alterada ou pedido pendente. O README exige revisão e reconfirmação quando a cotação muda; o clique não pode encaminhar direto ao sucesso sem resposta da simulação.

## 5. Desktop Confirmação de Pedido

[Frame `11:4385`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=11-4385) — **1440 × 1657**.

Mantém Checkout Page e Footer atrás de `BG` (`11:5105`), cujo preenchimento é `#140D0A` com opacidade de 60%. O modal Order Confirmation Modal (`70376:239`) mede **578 × 821**, posicionado em **x=431, y=166** no frame. Ele não foi desenhado centralizado na altura total de 1657.

Cabeçalho com ilustração vetorial de envelope “THANK YOU”, fechamento X e texto “Seus NFTs agora estão na sua carteira”. Faixa de metadados com ID `0xA91F…E82C`, data `29 Jul, 2026`, total `26.846 ETH` e carteira MetaMask.

Detalhes com os três NFTs, tokens #0042/#0314/#0088, quantidades 2/6/9 e subtotais 2.38/8.34/16.11. Taxa 0.016 e total 26.846. Texto afirma confirmação na Ethereum e transferência da propriedade. CTA Ver no Etherscan e faixa inferior de destaque.

Somente o sucesso está desenhado. A carteira MetaMask do recibo diverge da Coinbase selecionada no checkout. Data, ID, carteira, rede, valores e itens precisam vir do snapshot do pedido simulado. O destino do X e a apresentação do explorador simulado não estão definidos por protótipo.

## 6. Desktop Login

[Frame `9:115`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=9-115) — **1440 × 1981**.

Padding superior 24, laterais 120 e inferior 0. Usa Marketplace Page (`70522:3671`), `BG` (`9:945`) e Sign In Modal (`70381:239`). O BG não tem fill no arquivo exportado; o fundo continua visível, sem o escurecimento do recibo.

Modal de **500 × 600**, em **x=470, y=160**, com superfície `#241612`, X e faixa inferior de 10. Abas Entrar e Criar conta, com Entrar ativo. Texto: “Entre para gerenciar sua carteira, coleção e perfil de criador.”

Campo de e-mail de 340 × 40, senha de 340 × 40, ícone de mostrar/ocultar, Esqueceu a senha?, botão Entrar de 340 × 45, divisor “Ou continue com” e botões Google/Facebook de 340 × 40. O recuo horizontal de 80 é definido no componente social. O campo de senha aparece com borda de destaque; isso representa um estado visual, não autoriza manter foco falso permanentemente.

O fundo Marketplace Page difere da home principal: tem artes trocadas em cards, ações sobre um card, chip RARO e preço duplicado. A descrição do componente reconhece defeitos visuais congelados. Não há desenho de login inválido, expiração, recuperação de senha ou retorno ao checkout.

## 7. Desktop Cadastro

[Frame `9:1022`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=9-1022) — **1440 × 1981**.

Mesmo fundo do login, por outra instância Marketplace Page, com BG sem fill. Sign Up Modal (`70383:239`) de **500 × 656**, em **x=470, y=158**, superfície `#241612`, X e faixa inferior de 10.

Abas Entrar e Criar conta, com Criar conta ativo. Texto “Crie seu perfil de colecionador e conecte uma carteira quando quiser.” Quatro campos de 340 × 40: Nome de usuário, Digite seu e-mail, Senha e Confirmar senha. O desenho desktop mostra toggle na senha, mas não o mesmo ícone na confirmação. Botão Criar conta de 340 × 45; divisor e botões sociais.

Sem critérios de senha, mensagem de conflito de conta, validação, carregamento, sucesso ou destino após cadastro desenhados. A conexão imediata de carteira não é condição do cadastro na frase do layout.

## 8. Desktop Perfil do Colecionador

[Frame `9:1238`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=9-1238) — **1440 × 1080**.

Padding 24/120/24/120. Top de 1200 × 803, com cabeçalho e body separados por 32. Body de 1200 × 726: menu lateral e formulário à direita. Não há footer neste frame.

Menu Meu perfil: Dados do perfil ativo, Carteiras, Atividade, Lista de interesse, Ofertas, Arquivos baixados, Suporte e Sair. Há ícones e marcador vertical dourado no item ativo. Atividade, ofertas, downloads e suporte são páginas fora do escopo do README.

Formulário Perfil do colecionador com Nome de exibição, Nome de usuário, E-mail, Nome ENS com `.eth`, Apelido da carteira, avatar com Alterar/Remover. Abaixo, Alterar senha com Senha atual, Nova senha e Confirmar nova senha; cada campo possui ícone de visibilidade. Um único botão Salvar aparece ao final.

Os três campos de senha usam Password Input, de aproximadamente 417 × 40 no componente principal; a descrição declara a ausência de filho de texto e orienta a preservar o componente no Figma. O cabeçalho continua mostrando Entrar apesar da tela privada. Não há frame mobile, edição bem-sucedida, arquivo inválido ou erro de senha.

## 9. Desktop Carteiras

[Frame `9:1670`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=9-1670) — **1440 × 1080**.

Padding 24/120/24/120. Top 1200 × 716, body 1200 × 639. Mesmo menu de perfil, com Carteiras ativo, e cabeçalho Início com divisor. Formulário Wallets Form (`70390:239`) de 862 × 639. Não há footer.

Carteira principal, ação Adicionar e instrução explícita: **“Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.”** Campos em duas colunas: Nome de exibição, Apelido da carteira, Rede, Nome do perfil, Endereço da carteira, ENS ou carteira secundária (opcional), Tipo de carteira, Código de indicação, E-mail e Nome ENS com `.eth`. Botão Salvar carteira.

Seção Carteira secundária com opção Igual à carteira principal, Adicionar e estado vazio “Você ainda não adicionou uma carteira secundária.” Não há desenho da secundária expandida, edição de carteira salva, exclusão ou lista de opções dos selects.

O formulário combina identidade, endereço, ENS e indicação, mas o enunciado não fornece regras de negócio detalhadas para esses campos. Não se deve presumir obrigatoriedade de possuir um ENS real nem consultar blockchain.

## 10. Mobile Início

[Frame `14:5226`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=14-5226) — **414 × 896**.

Padding superior 40, laterais 24, inferior 0 e intervalo de 16. Raio externo 40. O conteúdo principal tem 366 de largura.

| Bloco | ID | Medidas e diferença em relação ao desktop |
| --- | --- | --- |
| Search Bar | `70395:239` | 366 × 45; campo de 313 e botão de filtro de 45 |
| Hero Banner | `70395:240` | 366 × 190; texto e composição de duas artes, círculos decorativos e três indicadores |
| Tabs | `70395:241` | 366 × 20; mesmas três categorias de catálogo |
| Product Grid | `70395:242` | 366 × 544; duas colunas de 175, intervalo de 16; coluna direita começa 32 abaixo |
| Tab Bar | `70395:245` | 414 × 126; sobreposta à parte inferior do grid |

O hero muda o título para **“SEJA DONO DA / CULTURA DIGITAL”** e o apoio para “Descubra NFTs selecionados de criadores do mundo todo.” O título é 18 com entrelinha 29; não é uma redução proporcional do hero desktop. A arte principal verde é acompanhada por arte menor de chapéu/moletom.

O grid mostra quatro cards em composição escalonada. Há favorito no primeiro e badge RARO no terceiro. Os textos inferiores dos cards ficam parcialmente encobertos pela barra. A arte do terceiro difere do nome Emerald Ape repetido na camada; a do quarto difere do nome Sage Nomad repetido. O footer, promos e blog não aparecem neste frame.

A barra inferior contém início, coração, um ícone central que lembra visor/experiência imersiva, carrinho e perfil. O destino do ícone central não está especificado. Filtros existem apenas como botão; drawer, ordenação e paginação mobile não estão desenhados.

## 11. Mobile Detalhes do NFT

[Frame `15:5536`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=15-5536) — **414 × 896**.

Padding externo 0, gap **-114**, raio externo 40. Três blocos sobrepostos: Hero (`70396:241`, 414 × 506), Details Sheet (`70396:242`, 414 × 504) e Buy Bar (`70396:245`, 414 × 164).

O hero tem voltar e favorito no topo, arte de 361 × 356 com raio 24 e recorte diferente do desktop. Existe um grupo de indicadores na hierarquia, sem uma galeria de miniaturas visível equivalente à desktop. A folha começa sobre a imagem e traz título, avaliação 4.8 (19), descrição, edições e metadados.

As edições são **1/10, 1/10, 1/50 e ABERTA**: a primeira diverge do 1/1 desktop. 1/50 está selecionada. Título de 20, descrição de 14/24 e metadados de 15. A folha usa padding superior 32, laterais 24 e inferior 24.

A Buy Bar tem padding 20/24/36/24, Qtd., stepper com 1, preço 1.19 ETH, botão Comprar NFT e botão de carrinho. Ela parece uma barra de ação inferior, mas **o arquivo não a configura como fixed no protótipo**. Não há aba de avaliações, descrição longa, compartilhamento ou produtos relacionados visíveis como no desktop.

## 12. Mobile Carrinho de NFTs

[Frame `16:360`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=16-360) — **414 × 896**.

Padding superior 32, gap 4, raio externo 40. Content de 414 × 518 com recuos laterais de 28; título/voltar de 358 × 44 e lista de 358 × 462. Cards de aproximadamente 358 × 100, separados por 20.

| Item | Edição | Quantidade | Total desenhado |
| --- | --- | --- | --- |
| Emerald Ape #042 | 1/50 | 1 | 1.19 ETH |
| Violet Nomad #314 | 1/1 | 1 | 1.39 ETH |
| Ivory Baron #088 | 1/10 | 2 | 3.58 ETH |
| Golden Beat #207 | 1/50 | 2 | 1.98 ETH |

Os dois primeiros sinais de menos aparecem atenuados, representando o limite inferior. O terceiro item tem uma lixeira sobreposta ao botão de adicionar; os demais não mostram a mesma ação de remoção. Isso não satisfaz, sozinho, a remoção exigida para todo item.

Payment Summary (`70397:245`) mede 414 × 342, com padding 24/24/36/24. Campo de cupom de 366 × 50, Aplicar acoplado e CTA de 366 × 60. O resumo mostra subtotal **8.92 ETH**, taxa **0.016 ETH** e total **8.936 ETH**. Os totais das linhas somam **8.14 ETH**, gerando conflito de 0.78 ETH antes da taxa. Não há item adicional oculto na lista que justifique a diferença.

A versão mobile usa quatro produtos e quantidades diferentes do desktop. Essa diferença pode representar fixtures distintas; não pode fazer o carrinho real mudar de dados quando se redimensiona a mesma sessão. Não há produtos relacionados, footer nem link Continuar explorando visível.

## 13. Mobile Pagamento

[Frame `16:748`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=16-748) — **414 × 896**.

Padding 32/28/32/28, raio externo 40 e conteúdo de 358 × 832. Título Pagamento com carteira e voltar. Carteira conectada com Trocar carteira. Dois cards: **Reserva / nova.kurio.eth / Rede Polygon**, selecionado, e **Principal / 0xA91F…E82C / Rede principal Ethereum**. Cada um possui menu de três pontos sem estado aberto desenhado.

“Carteira e rede” mostra WalletConnect, MetaMask e Coinbase Wallet, esta última selecionada. Os dois primeiros usam medalhões com W/M; Coinbase usa ícone de carteira. O total é **8.936 ETH** e o botão Confirmar compra mede 358 × 60, posicionado na parte inferior do conteúdo.

Não aparecem formulário do colecionador, itens, subtotal, desconto ou taxa detalhada. Não há passo anterior ou posterior desenhado para suprir essa ausência. O fluxo precisa manter validação e revisão exigidas pelo README. A primeira opção de provedor está clara no mobile, ao contrário do chip composto do desktop.

## 14. Mobile Login

[Frame `16:1022`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=16-1022) — **414 × 896**.

Página inteira, sem fundo de catálogo nem modal. Padding 80/28/24/28, gap de 40, raio externo 40 e conteúdo de 358. Bloco de logo de 358 × 136, palavra KURIO de 109 × 42 em Roboto Mono Bold 32 e espaçamento de letras do estilo Display/32.

Título Entrar; form de 358 × 140 com e-mail de 358 × 50, senha de 358 × 50, ícone de visibilidade e Esqueceu a senha?. O campo de senha está destacado. Botão Entrar de 358 × 60, raio 10. Mobile Social Block de 358 × 124, com divisor e dois botões. Link “Novo na Kurio? Crie uma conta”.

O texto auxiliar do modal desktop não aparece. Não existe X nem voltar visível, diferentemente das telas de compra mobile. O retorno ao fluxo anterior segue obrigatório pelo enunciado e precisa funcionar com o histórico/roteamento.

## 15. Mobile Cadastro

[Frame `16:1228`](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=16-1228) — **414 × 896**.

Mesmo espaçamento externo e logo do login. Título “Criar perfil de colecionador”, em 18. Form de 358 × 236 com quatro campos de 358 × 50, separados por 12: Nome de usuário, Digite seu e-mail, Senha e Confirmar senha. O placeholder de usuário está centralizado; os outros ficam alinhados à esquerda. Senha e confirmação exibem ícones de visibilidade.

Botão **Criar perfil**, de 358 × 60 e raio 10, em vez do “Criar conta” desktop. Mesmo Mobile Social Block e link “Já tem uma conta? Entre”. O último link está próximo da borda inferior do frame, tornando importante testar teclado virtual, zoom e mensagens de erro sem corte.

## Diferenças transversais

| Aspecto | Desktop | Mobile |
| --- | --- | --- |
| Dimensão desenhada | 1440 de largura; alturas variáveis | 414 × 896 em todos os seis frames |
| Navegação principal | Header com links e ações | Tab bar na home; voltar em detalhe/carrinho/pagamento; auth sem header |
| Identidade | Fundo café, dourado, creme e Roboto Mono | Mesma identidade, raios maiores e vários gradientes |
| Home | Hero amplo, sidebar, grid de três colunas, promo, blog e footer | Busca exposta, filtro por botão, hero próprio, duas colunas escalonadas e tab bar |
| Detalhe | Miniaturas, informação lateral e abas inferiores | Arte ampla, folha sobreposta e barra de compra |
| Carrinho | Tabela e resumo lado a lado | Cards empilhados e resumo inferior |
| Autenticação | Modais de 500 sobre o catálogo | Páginas completas |
| Checkout | Dados e revisão em duas colunas | Carteiras e provedores, sem formulário ou revisão completa desenhados |
| Perfil, carteiras, recibo | Frames disponíveis | Sem frames específicos |

Não há frames de tablet, largura 390 ou largura 768. Nenhum dos 15 frames possui conexões de protótipo; todos informam overflow NONE e zero filhos fixed na leitura de metadados. Isso descreve o arquivo, não elimina a necessidade de rolagem, responsividade e conteúdo acessível na aplicação.

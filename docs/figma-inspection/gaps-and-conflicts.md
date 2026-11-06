# Lacunas e conflitos com o enunciado

Este registro identifica problemas; **não altera o Figma nem incorpora funcionalidades novas**. “Obrigatório” significa que o próprio README já exige o comportamento. “Decisão de apresentação” significa que há necessidade funcional, mas falta um desenho que determine sua composição exata. As referências de nós podem ser abertas no [arquivo original](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1).

## Conflitos de dados e comportamento

| ID | Evidência verificada | Relação com o README | Consequência para a implementação |
| --- | --- | --- | --- |
| C01 | Carrinho mobile `16:360`: linhas 1.19 + 1.39 + 3.58 + 1.98 = **8.14**, mas subtotal `16:1015` é **8.92**; taxa 0.016 e total `16:1017` 8.936 | §3 exige valores coerentes com a API e precisão decimal | Não é possível reproduzir simultaneamente os números estáticos e a coerência da cotação. A API precisa fornecer valores consistentes; registrar a correção dos dados ilustrativos mantendo a composição |
| C02 | Violet Nomad #314 usa token #0009 no carrinho desktop (`11:2060`) e #0314 no checkout/recibo. Ivory Baron #088 usa #0552 (`11:2077`) e depois #0088 | Contratos tipados, recurso estável e snapshot de pedido (§3–5) | Uma identidade por NFT na fixture/API; não trocar token ao navegar. Registrar os rótulos ilustrativos divergentes |
| C03 | Edições desktop: 1/1, 1/10, 1/50, ABERTA. Mobile `15:5674` e `70410:4175` repetem 1/10 nas duas primeiras posições | §3 exige seleção/disponibilidade por edição consistente | Mesmo domínio de edição nos dois tamanhos; a correção do primeiro chip mobile deve ser explicitada, não ocultada |
| C04 | Imagens associadas a nomes mudam entre a home `2:2` e Marketplace Page `70504:3297`, fundo dos frames `9:115`/`9:1022`; mobile repete nomes sobre outras artes | Catálogo, detalhe, carrinho e pedido devem manter estado consistente (§3, §6) | Não usar resize/login como gatilho para trocar a identidade visual do mesmo NFT. Definir mapeamento estável de fixture e documentar as posições divergentes do design |
| C05 | Checkout desktop seleciona Coinbase Wallet (`70504:3187`); recibo `11:5138` diz MetaMask | §3 exige snapshot imutável da compra real da simulação | Recibo deve refletir a carteira efetivamente escolhida, não uma constante do frame |
| C06 | Mobile tem Reserva/Polygon selecionada; texto fixo do recibo desktop afirma confirmação na Ethereum | Seleção de rede e recibo da simulação (§3) | Rede deve pertencer ao snapshot. Não anunciar transferência real nem forçar Ethereum independentemente da seleção |
| C07 | Telas privadas perfil/carteiras e checkout mantêm botão Entrar; componente Header Row também especifica esse botão | Sessão e proteção privadas são obrigatórias (§3–4) | Falta variante autenticada. Preservar a identidade, mas definir ação/estado coerente e retomada sem exigir login repetido |
| C08 | Badge do header desenha 6, mesmo no carrinho desktop com três linhas e quantidades 2/6/9. Descrição diz cart item count | Estado de carrinho coerente (§3–4) | Contagem dinâmica é obrigatória; “linhas” versus “unidades” não foi definido. Não congelar 6 |
| C09 | Primeira opção desktop de Carteira e rede mostra chip com três marcas (`70504:3177`), enquanto o mobile identifica WalletConnect | Seleção de carteira/rede deve ser inequívoca (§3, §8) | Decidir apresentação da primeira opção sem confundir provedor, carteira salva e rede. O comentário #70 apenas sugere uma interpretação |
| C10 | Lixeira mobile de Ivory Baron está sobreposta ao botão de mais; os outros três itens não mostram a mesma remoção | Remover qualquer item é obrigatório (§3, §9) | A ação precisa ser acessível em todos os itens sem colisão de alvos; documentar o ajuste mínimo do desenho |
| C11 | Carrinhos desktop e mobile mostram produtos e quantidades diferentes | Persistência e integração do carrinho (§3, §6) | Pode haver cenários visuais distintos, mas a mesma sessão não pode ganhar/perder produtos por breakpoint. Baselines precisam declarar a fixture usada |
| C12 | Perfil tem um único Salvar após dados e alteração de senha; não há regra para salvar parte válida quando outra parte falha | §3 exige validação da API e persistência | Definir contrato/feedback para operações de perfil e senha sem criar sucesso parcial silencioso |

As seções 1 e 3 do enunciado já distinguem o papel das fontes: o Figma define identidade e composição; o README define comportamentos e avaliação. Corrigir uma soma da simulação não autoriza redesenhar os cards. Reproduzir visualmente uma soma incorreta não atende ao requisito funcional.

## Lacunas de desenho

| ID | Ausência ou ambiguidade | Evidência | Tratamento necessário |
| --- | --- | --- | --- |
| L01 | Tablet e larguras 390/768 | Somente frames 1440 e 414; README §8 exige 390, 768 e 1440 | Definir adaptação intermediária mantendo todos os conteúdos; comparar também em 414 para fidelidade ao frame existente |
| L02 | Perfil, carteiras e confirmação mobile | Não existem esses frames; README §3 os exige | Adaptar os componentes desktop à identidade mobile; não omitir telas nem alegar equivalência pixel a pixel com uma referência ausente |
| L03 | Dados do colecionador e revisão no pagamento mobile | Frame `16:748` contém carteiras, provedores e total; não contém form, itens, taxas ou etapa anterior | Incluir validação e revisão em apresentação coerente; escolher localização/etapa na proposta, sem inventar campos além dos desenhados/necessários |
| L04 | Busca desktop aberta | Header tem apenas ícone | O mecanismo de entrada e seu comportamento de foco precisam ser definidos para cumprir busca + URL |
| L05 | Filtros mobile abertos | Somente botão `70410:4122` na home | Drawer/dialog ou outra adaptação precisa conter os filtros exigidos; sem inventar categorias novas |
| L06 | Opções e estados de ordenação | Somente Listados recentemente fechado | Definir opções dentro do domínio do teste; comentário #6 não é especificação oficial |
| L07 | Paginação após a primeira página e seleção de filtros | Um estado de catálogo; não há frame de página 2 ou filtro combinado | URL, histórico e reset de página vêm do README; apresentação dos controles precisa preservar o padrão |
| L08 | Demais slides e autoplay | Indicadores desenhados sem conteúdo alternativo ou reactions | Não inferir autoplay nem tempo de transição. Identificar uma resposta funcional coerente para indicadores sem inventar promoções |
| L09 | Zoom, avaliações e galeria mobile | Detalhe desktop mostra lupa e aba de avaliações sem estado aberto; mobile não tem as miniaturas equivalentes | Galeria é obrigatória; apresentação das views adicionais e comportamento de seleção permanecem sem desenho |
| L10 | Diferença entre comprar e ícone de carrinho no mobile | Dois CTAs, nenhum destino de protótipo | Definir fluxo de inclusão/checkout conservando os controles fornecidos |
| L11 | Função do ícone central da tab bar mobile | Nó `15:5529` e grupo vetorial sem rótulo/destino; comentário #8 pergunta sua função | Não criar função AR/VR/scanner por interpretação visual. Registrar ação auxiliar coerente ou indisponibilidade explicada |
| L12 | Lista de favoritos | Coração mobile e Lista de interesse no menu, sem frame | Consulta e mutations são obrigatórias. Local e composição da lista precisam ser adaptados, sem expandir para atividade/ofertas |
| L13 | Carrinho vazio e cupom aplicado/removido | Só cenário preenchido com desconto zero | Estados obrigatório pelo README; conservar dimensões e linguagem dos componentes |
| L14 | Carteira secundária expandida | Somente estado vazio e Adicionar | Cadastro/edição exigidos; definir expansão e persistência usando o formulário existente |
| L15 | Semântica de Igual à carteira principal | Controle sem estado subsequente | Esclarecer cópia ou vínculo e efeito no checkout; não duplicar endereço silenciosamente com regras novas |
| L16 | Regras dos campos Rede, Tipo, ENS e Código de indicação | Selects fechados, asteriscos e placeholders, sem opções ou regras | Contratos simulados devem validar todos os campos previstos. Não exigir ENS, indicação ou carteira reais como condição técnica oculta |
| L17 | Conectar, recusar, desconectar e trocar carteira | Somente carteira já conectada e providers | Simular todos esses estados com API; não abrir extensão real |
| L18 | Cotação alterada e reconfirmação | Nenhum frame de mudança de preço/estoque/cupom/taxa | Informar alteração e exigir confirmação nova conforme README §3/7; não enviar cotação obsoleta |
| L19 | Pendente, recusado, timeout e reconexão | Só modal confirmado | Estados e recuperação idempotente são obrigatórios. Não reutilizar o texto de sucesso para estados diferentes |
| L20 | Loading, vazio, erro, retry e segundo plano | Nenhum frame específico | Skeletons com shimmer e reduced motion, feedbacks e retry obrigatórios pelo §4/6/8/9 |
| L21 | Autenticação inválida, expiração e conflito de cadastro | Somente formulários sem erros | Validar API, preservar contexto e tratar retorno; nenhuma nova regra de negócio deve ser presumida a partir dos placeholders |
| L22 | Avatar e senha com erro/sucesso | Apenas controles vazios | Definir mensagens associadas aos campos, validação de arquivo e persistência |
| L23 | Retorno/fechamento de modal e rota direta | X desenhado, sem destinations | Definir saída coerente e fallback de acesso direto, sem perder pedido ou checkout |
| L24 | Foco, teclado, zoom, leitores de tela | Frames não definem ordem de tabulação, trap/foco restaurado, labels de ícones ou live regions | Obrigatórios por §8; implementar sem depender só de cor e registrar ajustes visuais quando necessários |
| L25 | Scroll/sticky e teclado virtual | Todos reportam overflow NONE e fixed=0; barras parecem ancoradas visualmente | Não cortar conteúdo em 896 de altura. Testar rolagem, safe area, teclado virtual e expansão de erros sem esconder CTAs |
| L26 | Estado autenticado do header | Não existe variante correspondente | Decidir ação e feedback sem criar uma nova navegação completa |
| L27 | OAuth social, recuperação de senha e newsletter | Ações visíveis sem contratos/cenas específicas exigidas | Manter ações auxiliares coerentes, sem integrar serviços reais nem aparentar sucesso inexistente |

## Diferenças visuais que não são autorização para uniformizar

| ID | Diferença confirmada | Implicação |
| --- | --- | --- |
| V01 | Home/perfil/carteiras/auth têm header com divisor; telas Mercado não têm | Instrução explícita de Header With Divider. Preservar |
| V02 | Home mobile tem título e composição próprios, gradientes e arte secundária | Não reduzir proporcionalmente o hero desktop |
| V03 | Coluna direita do grid mobile começa 32 abaixo; fileiras desktop têm diferenças | Não alinhar tudo automaticamente porque um visitante sugeriu |
| V04 | Login/cadastro desktop usam modal; mobile é página inteira | Não forçar um único container ou overlay para ambos |
| V05 | Botões desktop mais retos; mobile tem combinações de raios 10/14/40 e gradientes | Adaptar shadcn/ui aos componentes fornecidos, sem manter visual padrão da biblioteca |
| V06 | BG do login/cadastro não tem fill; BG do recibo declara cor de fundo com 60% de opacidade no binário | A sugestão de overlay preto 60% do comentário #58 não é uma instrução do arquivo. Conferir o preenchimento resolvido antes de implementar o scrim |
| V07 | Modal de recibo em x=431/y=166; login em x=470/y=160; cadastro em x=470/y=158 | Não centralizar os modais pela altura total dos frames por mera convenção. A adaptação para viewports menores precisa preservar acessibilidade |
| V08 | Marketplace Page descreve preço 2.29 duplicado e badge RARO extrapolando canto como defeitos congelados | Preservar registro e pedir decisão de fidelidade na proposta; não “melhorar” silenciosamente |
| V09 | Placeholder de usuário no cadastro mobile centralizado; outros à esquerda | Diferença real, não presumir erro e alinhar tudo |
| V10 | Detalhe mobile tem sobreposição com gap -114; preço/quantidade vão para Buy Bar | A estrutura de layout difere da desktop; não comprimir duas colunas mantendo a mesma composição |
| V11 | E-mail/nomes de estilos contêm valores e descrições antigos; propriedades resolvidas podem diferir do binário | Referenciar o inspetor e os vínculos atuais; não escolher fonte/cor pelo nome da camada |

## Limites de assets e acesso

- Quatro PNGs originais já estão locais e íntegros. SVGs individuais ainda precisam ser exportados para a aplicação; todos foram identificados por componente/camada e permanecem na fonte `.fig`.
- Roboto Mono é a família principal vinculada. TTF/WOFF não foram fornecidos no pacote de imagens; a execução local terá de incluí-los. Registros antigos Inter não devem ser tratados como fonte efetiva sem resolver o estilo.
- A API recusou annotations no plano/arquivo, e depois esgotou a quota de chamadas. Isso não impediu a inspeção dos 15 frames por navegador e exportação, mas impede afirmar que annotations não acessíveis tenham sido examinadas.
- Não há autorização do enunciado para criar tema claro, blockchain, extensão de carteira, gateway, scanner/AR, páginas editoriais, suporte, atividade, ofertas ou downloads. Comentários sugerindo essas mudanças não ampliam o escopo.

## Decisões que a proposta precisará registrar

1. Critério de fidelidade para dados ilustrativos incompatíveis: identidade e cotação coerentes da API, com desvios dos textos/fixtures inconsistentes explicitados.
2. Adaptação mobile de perfil/carteiras/recibo e inclusão de dados/revisão do checkout.
3. Apresentação de busca desktop, filtros/ordenação/paginação mobile, favoritos e estados sem desenho.
4. Destino dos CTAs de compra, X do recibo, ícone central e ações auxiliares, mantendo o escopo.
5. Contagem do badge, semântica das carteiras e validação dos campos ambíguos.
6. Tratamento dos defeitos visuais declaradamente congelados no Marketplace Page, separado das diferenças intencionais que precisam ser preservadas.

Essas decisões ainda não foram tomadas por esta inspeção. O levantamento permite escrevê-las com referências, em vez de convertê-las em suposições durante o código.

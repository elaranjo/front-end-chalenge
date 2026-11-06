# Navegação e comportamento

## O que está efetivamente definido no Figma

A leitura dos 15 frames e de seus descendentes pela API encontrou **zero nós com reactions de protótipo**. A exportação local também não contém ações de navegação configuradas. Não há evidência de transições executáveis, tempos de animação, autoplay, breakpoints, gatilhos de hover ou gestos especificados por protótipo.

Isso não significa que a interface deva ser estática. O enunciado exige os fluxos completos. Significa que a ação de cada controle precisa ser classificada como instrução escrita, requisito do README ou inferência de significado, em vez de alegar que um clique foi validado no protótipo.

Instruções verificadas nas descrições de componentes:

- **Filters:** coleções e redes são checkboxes combináveis; faixa de preço possui Aplicar; painel fixo de 310.
- **Header Row:** aba ativa conforme a tela; badge ligado à contagem do carrinho. “Item count” não esclarece se conta linhas ou soma quantidades.
- **Password Input:** senha com toggle de visibilidade.
- **Social Button:** provedor determina marca/texto, com largura preenchendo o pai.
- **Footer:** por último no conteúdo, abaixo do scrim quando houver modal.
- **Carteiras, texto da própria tela:** carteiras cadastradas ficam disponíveis no pagamento e no recebimento dos NFTs comprados.

As demais instruções de composição estão em [Componentes e assets](components-and-assets.md). Todos os frames reportam overflow NONE e zero filhos fixed, inclusive os que parecem ter barra inferior fixa. Não é possível atribuir comportamento sticky/fixed apenas pela aparência.

## Mapa de ações

“Inferido” abaixo identifica um destino semanticamente provável, **sem conexão desenhada**. Nenhuma URL interna foi definida nesta inspeção.

| Origem e controle | O que o desenho demonstra | Comportamento necessário ou lacuna |
| --- | --- | --- |
| KURIO e Início no header | Marca e item de navegação | Retorno à home é inferido; preservar o contexto de autenticação quando aplicável |
| Mercado no header | Aba ativa em detalhe, carrinho e checkout | Catálogo/mercado é o destino inferido; não há um frame separado chamado Mercado |
| Criadores e Aprenda | Links no header | Não há telas correspondentes no escopo; não aparentar fluxo implementado |
| Busca no desktop | Ícone no header | O README exige busca e URL; abertura do campo, popup ou outra forma não está desenhada |
| Busca no mobile | Campo Explorar coleções | Consultar API simulada, compor URL e suportar restauração pelo histórico |
| Filtro mobile | Botão com ícone | Conteúdo e abertura de drawer/dialog não foram desenhados; filtros continuam obrigatórios |
| Coleções e redes | Lista com contagens; descrição define checkboxes | Combinar filtros; atualizar consulta e URL; reiniciar paginação |
| Faixa de preço e Aplicar | Slider de dois limites e CTA | Limites do cenário, validação e momento de aplicação precisam ser especificados; não trocar por campos novos só por sugestão de visitante |
| Todos os NFTs / Novos lançamentos / Em alta | Abas; primeira ativa | Mudar estado de descoberta/consulta é inferido; a definição exata de “Em alta” não está no arquivo |
| Ordenar por | Valor fechado Listados recentemente | Ordenação é obrigatória; opções do menu não estão oficialmente definidas |
| Paginação 1–4 e seta | Página 1 ativa, avanço | API paginada + URL + histórico. Estado do botão anterior e limite final não desenhados |
| Card do NFT | Imagem, nome e preço | Navegar ao detalhe é exigido; preservar identificador estável do recurso |
| Ações sobre card no fundo da autenticação | Carrinho, coração e lupa sobre um card | Aparência de um estado de ação/hover, sem gatilho configurado. Não aplicar esse estado permanentemente a todos os cards |
| Favorito de card, coração da tab bar e Favoritar no detalhe | Ícones/CTA | Inclusão/remoção e consulta autenticadas, persistentes; lidar com login necessário e falha/rollback. Lista de favoritos não tem frame próprio |
| CTA EXPLORAR e promos | Botão e indicadores de hero | Explorar catálogo é inferido. Conteúdo dos demais slides e autoplay não especificados |
| Cards do blog, newsletter e links do footer | Seções visíveis com CTAs | Preservar composição. Páginas editoriais/apoio estão fora do escopo; sem simular envio ou cadastro bem-sucedido inexistente |
| Carrinho no header/tab bar | Ícone e badge no desktop | Abrir carrinho é inferido e necessário ao fluxo; badge deve acompanhar estado real da simulação |
| Ícone central da tab bar mobile | Ícone semelhante a visor/experiência imersiva | Sem destino nem significado funcional documentado. Não criar scanner, AR, metaverso ou nova tela |
| Perfil na tab bar | Ícone de usuário | Acesso a conta é inferido; exigir autenticação e permitir retomada |
| Miniaturas/lupa do detalhe | Quatro imagens repetidas e controle de zoom | Galeria exigida; zoom aberto e apresentação mobile não têm desenho. Miniaturas não devem ser interpretadas como NFTs diferentes sem evidência |
| Edições do NFT | Chips de edição; 1/50 ativo | Seleção e disponibilidade por NFT/edição exigidas. Resolver a duplicação de 1/10 no mobile |
| Stepper do detalhe/carrinho | Menos, quantidade, mais | Quantidades inteiras e limites da API; desabilitar controles quando necessário. Não usar quantidade como edição |
| COMPRAR / Comprar NFT | CTA principal; mobile também tem ícone de carrinho | Compra e inclusão no carrinho são necessárias. Destino direto do CTA principal versus CTA de carrinho não está ligado por protótipo |
| Voltar em detalhe/carrinho/pagamento mobile | Seta | Retorno é inferido; acesso direto também precisa funcionar quando não houver histórico interno |
| Lixeiras do carrinho | Uma por linha no desktop; uma sobreposta no mobile | Remoção deve existir para todos os itens. O acesso mobile sem sobreposição é lacuna de desenho |
| Cupom e Aplicar | Campo e CTA | Aplicar/remover cupom; feedback de inválido/expirado; resumo da API. Estado aplicado não desenhado |
| Conectar e finalizar | CTA do carrinho | Entrar no checkout autenticado, preservando carrinho do visitante e contexto do fluxo |
| Formulário do pagamento | Campos e asteriscos | Validar campos do layout e API. Mesmo obrigatório no mobile; posição/etapa ainda indefinida |
| Usar outra carteira? | Controle no checkout desktop | Intenção de alternar carteira é visível; efeito exato sobre o formulário não está desenhado |
| Wallet cards mobile | Reserva/Principal, seleção e menus | Usar carteiras persistidas; menus de três pontos e seleção de rede não têm estados abertos |
| Trocar carteira | Link no checkout mobile | Simulação de conectar, recusar e desconectar exigida. Nenhuma extensão real deve ser aberta |
| WalletConnect / MetaMask / Coinbase | Radios de provedor | Seleção simulada; separar provedor, carteira cadastrada e rede. Corrigir a identidade ambígua da primeira opção desktop somente por decisão registrada |
| Confirmar compra | CTA de checkout | Revalidar cotação; exigir nova confirmação se mudou; criar/recuperar pedido idempotente; nunca produzir sucesso só pelo clique |
| X do recibo | Fechamento desenhado | Fechar é inferido; destino posterior e recuperação por URL não especificados |
| Ver no Etherscan | CTA e texto de confirmação | Transação/explorador simulados. Não apresentar o identificador fictício como transação real |
| Entrar no header | Botão presente em todas as telas desktop | Abrir login é inferido. Estado autenticado do header não desenhado |
| Abas Entrar/Criar conta no modal | Troca visual de modo | Alternância entre autenticação e cadastro é inferida; proteger dados e preservar fluxo anterior |
| Links inferiores do login/cadastro mobile | Convites para a outra tela | Navegar entre login e cadastro é inferido |
| Olho nos campos de senha | Controle de visibilidade | Alternar texto/senha com nome acessível e foco; não salvar senha em claro |
| Esqueceu a senha? | Link em login | Recuperação de senha não tem frame/contrato exigido específico. Não criar um fluxo externo real nem fingir envio de e-mail |
| Google/Facebook | Botões sociais desenhados | APIs/auth são simuladas. Provedores reais não são exigidos; definir ação auxiliar coerente sem falso sucesso |
| Dados do perfil / Carteiras | Menu lateral com item ativo | Navegação privada entre telas fornecidas; dados persistem após refresh |
| Lista de interesse | Item do menu e coração mobile | Consulta de favoritos obrigatória, mas apresentação não desenhada |
| Atividade / Ofertas / Arquivos baixados / Suporte | Itens do menu | Páginas explicitamente fora do escopo do README |
| Sair | Item do menu | Logout, limpar cache privado e subscriptions, preservar somente o contexto permitido |
| Alterar/Remover avatar | Ações no perfil | Selecionar/validar/remover avatar pela API simulada; estados e limites de arquivo não desenhados |
| Salvar no perfil | Único CTA após dados e senha | Persistência e validação obrigatórias. Atomicidade entre mudança de dados e de senha não definida |
| Adicionar / Salvar carteira | Ações de carteiras | Cadastro/edição da principal e secundária; erros de API e persistência |
| Igual à carteira principal | Controle na secundária | Semântica exata de copiar/referenciar/sincronizar não documentada |

## Estados exigidos que não têm frame

| Família | Estados que precisam ser cobertos segundo o README |
| --- | --- |
| Dados remotos | Skeleton com shimmer, reduced motion, atualização em segundo plano, vazio, erro, retry e respostas obsoletas |
| Sessão | Visitante, autenticado, expiração, retomada do checkout, logout e troca de usuário sem vazamento |
| Catálogo/detalhe | Filtros combinados, páginas adicionais, NFT inexistente, edição esgotada e limite de quantidade |
| Favoritos | Ativo/inativo, mutation pendente, falha e rollback otimista |
| Carrinho/cupom | Vazio, alteração de quantidade, remoção, cupom ativo/removido/inválido/expirado e preço/estoque alterado |
| Carteiras | Cadastrada/não cadastrada, conexão em andamento, recusa, desconexão e rede selecionada |
| Pedido | Revisão, cotação alterada, envio, timeout após criação, pendente, confirmado, recusado e recuperação por refresh/reconexão |
| Formulários | Erro por campo, conflito de cadastro, senha inválida, avatar inválido, erro transitório e sucesso persistido |
| Acessibilidade | Foco visível, foco/trap/retorno em modal e drawer, feedback anunciado, campos associados a erros e conteúdo acessível com zoom |

Não é necessário inventar funcionalidades para preencher esses estados. São comportamentos já exigidos pelo teste, que precisarão de apresentações coerentes com a identidade existente. As decisões concretas devem ser documentadas na proposta e depois em ARCHITECTURE.md.

## Comentários públicos

Os comentários acessíveis do original foram percorridos, incluindo a opção de mostrar resolvidos; as três threads com respostas visíveis sobre ordenação (#6), paginação (#7) e ícones (#17) foram abertas. Não foi identificada nessas threads uma resposta do responsável pelo desafio que fechasse os requisitos.

- #6: Roger_Lucena descreve as opções que implementou (alfabéticas, preço e recentes). Isso é relato de participante, não lista oficial do menu.
- #7: a resposta sugere voltar e uma tag de total. Não autoriza adicionar essa tag ao design.
- #17: a resposta sugere Font Awesome. Não autoriza substituir os vetores fornecidos.
- #3, #4, #8, #14, #16, #19, #20, #21, #23 e #70 levantam lacunas de mobile, filtros, botão central, sessão, remoção, estados de pedido, formulário mobile, tokens, galeria e provedor. As lacunas foram conferidas no desenho, sem transformar perguntas em especificações.
- Comentários de tk, afonsovinicius e outros sugerem alinhamentos, margens, raios, tipografia, overlay e correções de imagens. São feedback público, não autorização para reformular o layout.

A numeração de comentários apresenta saltos; não se infere o conteúdo de comentários ausentes ou privados. Também não se presume acesso a annotations que a API recusou.

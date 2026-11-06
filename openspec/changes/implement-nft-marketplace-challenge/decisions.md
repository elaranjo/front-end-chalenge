# Decisões de produto e fidelidade

Fonte: README §§1–12 e `docs/figma-inspection/`. Os IDs abaixo correspondem integralmente ao inventário de conflitos/lacunas/diferenças. Uma decisão de implementação não é apresentada como instrução do autor do Figma. `design.md` rege arquitetura; `contracts.md` detalha validações. Estados não desenhados reutilizam tokens/componentes existentes. Não haverá funcionalidades adicionais para preencher espaços.

## Conflitos funcionais

| ID | Decisão fechada | Evidência e efeito visível |
| --- | --- | --- |
| C01 | Cotação vem da API; cenário mobile soma 8.14 + 0.016 = 8.156 ETH, sem desconto. | README §3; substituir somente subtotal/total inconsistentes 8.92/8.936, preservar geometria. |
| C02 | Tokens canônicos Emerald #0042, Violet #0314, Ivory #0088. | Checkout/recibo e identidade consistente; corrigir rótulos do carrinho, sem trocar IDs por rota. |
| C03 | Quatro modalidades 1/1, 1/10, 1/50, ABERTA em ambos os tamanhos. | Detalhe desktop; corrigir primeiro chip mobile repetido. |
| C04 | Uma arte canônica por NFT, determinada pela home/detalhe desktop. | README §§3/6; fundo de auth e nomes mobile usam o mesmo mapeamento. Registrar cada slot divergente no manifest visual. |
| C05 | Carteira no recibo é a carteira do pedido. | Snapshot exigido; não copiar MetaMask se outra foi selecionada. |
| C06 | Rede no recibo é a rede do pedido; explicitar simulação no explorador. | Não anunciar Ethereum em compra Polygon nem transferência real. |
| C07 | Visitante vê Entrar; autenticado vê Meu perfil no mesmo botão e abre `/profile`. | Necessário à sessão; preservar dimensões, fonte e estilo do botão. |
| C08 | Badge soma unidades; vazio não mostra badge. | Mobile contém seis unidades; descrição cart item count. Desktop exemplificado terá 17, não seis. |
| C09 | Primeiro radio representa WalletConnect. | Identificação explícita no mobile; desktop conserva chip fornecido, acrescenta nome acessível e título WalletConnect no espaço da opção. Não representa três seleções simultâneas. |
| C10 | Todos os cards mobile têm remoção separada do stepper, no canto superior direito com nome acessível. | Ajuste mínimo necessário para remover qualquer item sem colisão; manter demais dimensões. |
| C11 | Fixtures visuais separadas desktop/mobile, escolhidas antes da navegação. | Resize nunca muda carrinho, coleção, sessão ou dados. |
| C12 | Salvar perfil é atômico, incluindo senha opcional e avatar em edição. | Erro em qualquer parte preserva todos os dados anteriores; inputs válidos permanecem editáveis para correção. |

## Estados sem frame

| ID | Decisão fechada | Verificação |
| --- | --- | --- |
| L01 | Mobile <768, tablet 768–1279, desktop >=1280. Tablet usa header compacto e grid de duas colunas, recuos de 28, filtros em Sheet; carrinho em cards e checkout por passos. Formulários uma coluna até 1023, duas a partir de 1024. Detalhe empilhado com largura máxima 720. | 390/768/1440 sem perda; 414 fiel ao frame. |
| L02 | Perfil/carteiras mobile usam campos desktop em uma coluna, navegação Meu perfil em Sheet e mesmas ações. Recibo usa conteúdo desktop em página/diálogo rolável de largura disponível, sem retirar itens/taxas/metadados. | Navegação e salvamento/recibo integral em 390. |
| L03 | Checkout <1280 tem dois passos na mesma rota: Dados e revisão; Carteira e rede. O segundo reproduz o frame mobile. Link Revisar abre Sheet com dados, itens, desconto, taxa e total; campos não mudam por breakpoint. | Revisão disponível antes de confirmar; voltar conserva draft. |
| L04 | Busca desktop abre Popover ancorado à lupa com input, foco inicial, Escape e retorno de foco. Busca mobile permanece exposta. | URL/histórico sincronizados, debounce 300 ms. |
| L05 | Filtro mobile/tablet abre Sheet com todas as categorias/redes, faixa e ordenação; Aplicar confirma draft e reinicia página. Fechar sem Aplicar descarta draft. | Foco preso/restaurado e filtros combinados equivalentes desktop. |
| L06 | Menu: Listados recentemente, Nome A–Z, Nome Z–A, Menor preço, Maior preço. | Campos já presentes; não é reprodução do comentário de visitante. |
| L07 | Nove resultados por página; paginação abaixo do grid também mobile. Checks/seleção refletem URL; contagens vêm da API sobre o catálogo base, não números decorativos incompatíveis. | Página 2, refresh, back/forward e reset em filtro. |
| L08 | Indicadores dos banners são decorativos, sem autoplay ou mudança de promoção. CTA Explorar leva ao catálogo existente na página. | Não inventar slides não fornecidos nem foco em indicador inerte. |
| L09 | Miniaturas selecionam imagem; lupa/arte mobile abre Dialog com a mesma galeria e controles Anterior/Próxima. Fixtures reutilizam imagens disponíveis sem inventar artes. Avaliações mostra nota/contagem existentes e informa ausência de comentários disponíveis, sem inventar avaliações individuais. | Galeria por teclado/gestos de clique, Escape e retorno; aba sem fake conteúdo. |
| L10 | Comprar inclui edição/quantidade e navega ao carrinho após sucesso; ícone carrinho adiciona e permanece no detalhe. | Falha não navega nem mostra sucesso; checkout exige autenticação. |
| L11 | Ícone central preservado; clique informa “Recurso indisponível nesta demonstração” em feedback acessível. | Não abrir AR/VR/scanner ou página nova. |
| L12 | `/favorites` privada, grid de cards existente, menu Meu perfil e retorno ao catálogo. | Favoritos persistidos, vazio/erro e rollback. |
| L13 | Carrinho vazio tem mensagem e Continuar explorando; cupom válido mostra código, desconto e Remover no resumo; inválido/expirado tem erro associado. | Não renderizar checkout ativo em carrinho vazio. |
| L14 | Adicionar secundária expande cópia do formulário principal, editável e persistida no slot secundário. | Refresh recupera ambas; edição não cria terceiro slot. |
| L15 | Igual à principal copia os campos atuais para o draft secundário uma vez; permanece editável e só Salvar persiste. Não é vínculo permanente. | Edição posterior da principal não altera secundária silenciosamente. |
| L16 | Redes Ethereum/Polygon/Solana; tipos WalletConnect/MetaMask/Coinbase Wallet. Campos com asterisco exigem valor; ENS é rótulo simulado com sufixo .eth, sem consulta ou propriedade real. Indicação exige texto, sem validação externa, benefício ou programa. | Regras completas em contratos; nenhum campo oculto/integração real. |
| L17 | Conectar faz mutation simulada com estados connecting/connected/refused/disconnected; Trocar desfaz conexão e permite selecionar novamente. Menu de carteira oferece Editar e Desconectar. | Recusa/erro preservam draft; não abre extensão. |
| L18 | Mudança de preço/estoque/cupom/taxa invalida aceite, informa diferenças e exige revisar e confirmar de novo. | Nenhuma submissão automática com nova cotação. |
| L19 | Rota de pedido mostra Pendente, Recusado ou recibo Confirmado conforme API; timeout mostra verificando tentativa e recupera pela mesma chave. | Refresh/reconnect sem nova compra; recusa mantém carrinho. |
| L20 | Skeleton shimmer dimensional em catálogo/detalhe/resumo; vazio, erro com Tentar novamente e atualização sem apagar conteúdo existente. | Reduced motion remove shimmer; retry não duplica mutation. |
| L21 | Erros por campo/gerais da API, conflito de cadastro e sessão expirada com retorno seguro ao destino. | Não impor senha forte ou regras de username não fornecidas. |
| L22 | Avatar PNG/JPEG/WebP até 2 MiB, limite técnico explícito; preview local staged e commit atômico no Salvar. Alterar senha exige atual correta, nova não vazia e confirmação igual. | Mensagens de arquivo/senha, sucesso persistido, sem senha armazenada em claro. |
| L23 | Rotas e fallbacks de `design.md` D05; fechar recibo volta à home, URL do pedido continua recuperável. Auth direto usa home de fundo desktop, sucesso retorna returnTo validado. | Nada depende de histórico anterior; recusa de returnTo externo. |
| L24 | Ordem de foco segue leitura; Dialog/Sheet trap+Escape+restauração; ícones nomeados, erros associados e feedback aria-live; estados combinam texto e cor. | Teclado completo, zoom 200% e reflow 400%, sem conteúdo perdido. |
| L25 | Página e modais rolam; barras sticky com área reservada/safe-area; em baixa altura/teclado virtual a rolagem alcança CTA/erros. | Não deduzir fixed/scroll do protótipo vazio; não cortar em 896. |
| L26 | Mesmo tratamento de C07; menu privado já existente fornece logout e favoritos. | Sem inventar avatar-dropdown global. |
| L27 | Google/Facebook/Esqueceu senha/newsletter e páginas auxiliares fora do escopo mostram indisponibilidade honesta; newsletter valida e-mail antes de informar ausência de serviço. Compartilhar usa URL local/copiar ou URL oficial de share; explorador abre Sheet “Transação simulada” com ID/rede/estado. | Nunca login, envio ou transferência ficticiamente bem-sucedidos; nenhum gateway externo real. |

## Diferenças intencionais

| ID | Decisão fechada |
| --- | --- |
| V01 | Preservar divisor nos contextos indicados; header Mercado sem divisor. |
| V02 | Preservar hero mobile com texto, gradientes, círculos e duas artes próprios. |
| V03 | Preservar deslocamento 32 da coluna mobile e diferenças das fileiras desktop por referência de camada. |
| V04 | Auth desktop modal sobre catálogo; mobile página inteira. |
| V05 | Tokens/raios por variante 10/14/40 e gradientes originais; sem defaults visuais shadcn. |
| V06 | Auth sem scrim preenchido; recibo #140D0A a 60%, sujeito à conferência de propriedade resolvida antes do baseline. Não adotar sugestão de overlay preto de visitante. |
| V07 | Em referência desktop x/y de auth e recibo são os registrados; em alturas menores manter margem superior acessível e rolagem interna, sem centralizar pela altura total da página. |
| V08 | Preservar preço fantasma 2.29 e badge RARO extrapolado no fundo Marketplace Page como composição congelada; sem criar item cobrável duplicado ou duplicar texto acessível. |
| V09 | Placeholder de usuário mobile centralizado; outros à esquerda. |
| V10 | Preservar sobreposição -114 e Buy Bar do detalhe mobile. |
| V11 | Roboto Mono e valores atuais resolvidos, sem usar nome antigo de estilo como prova. Evidência em typography-verification.json. |

## Alcance das decisões

As decisões fecham o comportamento conhecido, não afirmam acesso a annotations recusadas nem substituem exports faltantes por aproximações. Aquisição de SVGs, fontes, capturas limpas e compatibilidade do transporte são tarefas de implementação com gates explícitos; uma tela não fica pronta enquanto faltar evidência visual. Todo desvio permitido C01–C10 e ajuste acessível recebe entrada localizada no manifest comparativo e em ARCHITECTURE.md. Correções de dados não autorizam mudanças livres de espaçamento ou arte.

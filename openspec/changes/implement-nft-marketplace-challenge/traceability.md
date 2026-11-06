# Rastreabilidade e revisão de cobertura

Planejamento baseado no README original e na inspeção congelada. As referências E/G abaixo identificam critérios de `verification.md`; seu estado real está na seção de execução ao final deste documento. A auditoria estrutural verifica cobertura dos IDs e links, não demonstra comportamento da aplicação.

## Fontes do enunciado

| Fonte | Obrigações revisadas | Requisitos |
| --- | --- | --- |
| §1 Escopo | Nove fluxos desktop/mobile, dados simulados, estados sem frame, sem integrações reais. | IF01 IF03 IF06 MN04 |
| §2 Stack | Uso efetivo de todas as 12 tecnologias, sem troca de Router/Query/Axios/MSW/Socket.IO. | DV01 MN01 MN05 |
| §3 Telas | Home, detalhe, cart, pagamento, confirmação, auth, perfil e carteiras; favoritos consultáveis e links auxiliares honestos. | IF01 IF03 IF06 CD01 CD04 CS01 CA01 CA03 CO01 CO07 |
| §3 Catálogo/detalhe | URL/histórico/reset, combinações, API/out-of-order/vazio/erro, detalhe direto/404/edição/quantidade e favoritos persistentes. | CD01 CD02 CD03 CD04 CD06 |
| §3 Cart | CRUD, estoque, refresh/merge, cupom invalid/expired/remover, cotação precisa em string ETH e realtime. | NC01 NC02 NC03 NC04 NC05 |
| §3 Compra | Campos/revisão, carteiras/rede/recusa/desconexão, quote/reaceite, idempotência/timeouts, estados/recuperação, cart parcial e snapshot imutável/simulação. | CO01 CO02 CO03 CO04 CO05 CO06 CO07 |
| §3 Conta | Cadastro/login/logout/refresh/expiração/retomada/isolamento; perfil/avatar/senha/wallets/API/persistência, senhas sem claro. | CS01 CS02 CS03 CS04 CS05 CA01 CA02 CA03 CA04 |
| §4 Integração/estado | Contratos, estados remotos, invalidação/cancelamento/isolamento/recovery/rotas, otimista+rollback e política documentada. | MN01 IF04 CD03 CD06 CS02 CS04 RR05 DV05 |
| §5 REST | Todos os oito recursos mínimos, erros 400/401/403/404/409/422/5xx, idempotência mesma tentativa/conteúdo diferente. | MN01 CO04 |
| §6 MSW | Rede somente, estado consistente/reset, todos os cenários, dois usuários/variedade, binding/protocolo real, ativação por configuração/build e DB/eventos coerentes. | MN01 MN02 MN03 MN04 MN05 |
| §7 Realtime | nft.updated/order.updated identificados/versionados; dedup/antigos/terminal/owner/cleanup, reconexão REST, preço com cart+quote e pendência recuperável. | RR01 RR02 RR03 RR04 RR05 NC04 CO03 CO05 |
| §8 UI | Figma/identidade/assets/fontes, shadcn adaptado, 390/768/1440, shimmer/reduced motion/CLS, teclado/foco/semântica/labels/alts/contraste/live/zoom/overflow. | IF01 IF02 IF03 IF04 IF05 |
| §9 Playwright | Doze grupos E01–E12, Chromium desktop/mobile, quatro telas com regressão visual, baselines estáveis, isolamento/clock/latência/events, HTML/trace/UI+rede. | DV02 DV03 |
| §10 Lighthouse | duas páginas × dois perfis × três execuções = 12, metas 90/95/95/90, medianas/HTML/JSON/configuração/versões/ambiente/LCP/CLS/TBT, justificar baixo sem auditoria simplificada. | DV04 |
| §11 Critérios | Evidências dos 100 pontos e verificação explícita dos eliminatórios. | DV01 DV02 DV03 DV04 DV05 DV06 CS04 CO05 MN05 |
| §12 Entrega | Fontes/lockfile/assets/mocks/fixtures/tests/audit, repoURL+appURL/deploy obrigatório consistente/acessível/acesso direto/refresh, README/ARCHITECTURE/comandos/checkout limpo. | DV01 DV05 DV06 |

## Requisito → tarefas → evidência

| Requisito | Fonte | Tarefas | Evidência prevista |
| --- | --- | --- | --- |
| [CD01 Consulta refletida na URL](specs/catalog-discovery/spec.md) | README §3/4 | 4.1, 6.1 | E01 |
| [CD02 Ordenação e paginação consistentes](specs/catalog-discovery/spec.md) | README §3/6 | 3.3, 6.1 | E01 |
| [CD03 Resultados atuais e estados remotos](specs/catalog-discovery/spec.md) | README §3/4 | 4.1, 5.1, 6.1 | E01 E12 |
| [CD04 Detalhe e disponibilidade](specs/catalog-discovery/spec.md) | README §3 | 6.2 | E02 |
| [CD05 Galeria e CTAs](specs/catalog-discovery/spec.md) | README §3 | 6.3 | E02 E06 |
| [CD06 Favoritos privados com recuperação](specs/catalog-discovery/spec.md) | README §3/4 | 6.4 | E04 |
| [CO01 Dados e revisão completos](specs/checkout-orders/spec.md) | README §3 | 9.1 | E06 E11 |
| [CO02 Carteira e rede simuladas](specs/checkout-orders/spec.md) | README §3 | 4.2, 9.2 | E06 E07 |
| [CO03 Cotação fresca e reconfirmação](specs/checkout-orders/spec.md) | README §3/7 | 3.4, 9.3 | E09 G03 |
| [CO04 Criação idempotente](specs/checkout-orders/spec.md) | README §3/5/6 | 3.4, 4.3, 9.4 | E07 G03 |
| [CO05 Estados e recuperação](specs/checkout-orders/spec.md) | README §3/7 | 3.4, 4.3, 9.4, 10.2 | E07 E10 |
| [CO06 Estoque e carrinho com efeitos únicos](specs/checkout-orders/spec.md) | README §3 | 3.4, 3.5, 4.3, 9.5 | E06 E07 G03 |
| [CO07 Snapshot e transação simulada](specs/checkout-orders/spec.md) | README §3 | 3.4, 4.3, 9.5 | E06 G05 |
| [CA01 Perfil e senha atômicos](specs/collector-account/spec.md) | README §3/5 | 4.2, 8.1 | E08 |
| [CA02 Avatar validado e persistente](specs/collector-account/spec.md) | README §3/5 | 4.2, 8.1 | E08 |
| [CA03 Carteiras principal e secundária](specs/collector-account/spec.md) | README §3/5 | 4.2, 8.2 | E08 |
| [CA04 Validação simulada sem integração real](specs/collector-account/spec.md) | README §3/5 | 4.2, 8.2 | E08 |
| [CS01 Cadastro e login validados](specs/collector-session/spec.md) | README §3/5/6 | 3.2, 4.2, 5.2 | E03 |
| [CS02 Rotas privadas e retorno seguro](specs/collector-session/spec.md) | README §3/4 | 1.3, 5.2, 5.3 | E03 E06 |
| [CS03 Sessão recuperada e expirada](specs/collector-session/spec.md) | README §3/4 | 4.2, 5.3, 9.4 | E03 E07 |
| [CS04 Logout e isolamento](specs/collector-session/spec.md) | README §3/4/7 | 5.4, 6.4, 8.3, 10.3 | E03 E04 E10 |
| [CS05 Navegação de autenticação](specs/collector-session/spec.md) | README §3/8 | 5.2 | E03 G05 |
| [DV01 Stack efetiva e execução limpa](specs/delivery-verification/spec.md) | README §2/4/12 | 1.1, 1.2, 1.3, 11.5, 12.1 | G01 G07 |
| [DV02 E2E e regressão visual](specs/delivery-verification/spec.md) | README §9 | 11.1, 11.5 | E01 E02 E03 E04 E05 E06 E07 E08 E09 E10 E11 E12 |
| [DV03 Prova independente de fidelidade](specs/delivery-verification/spec.md) | README §8/9/11 | 2.1, 11.2, 11.5 | G02 G05 |
| [DV04 Auditoria completa](specs/delivery-verification/spec.md) | README §10 | 11.4, 11.5 | G06 |
| [DV05 Documentação e limites](specs/delivery-verification/spec.md) | README §4/5/6/7/12 | 5.1, 12.1, 12.2 | G07 |
| [DV06 Publicação obrigatória](specs/delivery-verification/spec.md) | README §12 | 12.3, 12.4 | G07 |
| [IF01 Fidelidade às quinze referências](specs/interface-fidelity/spec.md) | README §1/3/8 | 2.1, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2 | G02 G05 |
| [IF02 Assets e fontes locais](specs/interface-fidelity/spec.md) | README §8/12 | 2.1, 2.2 | G02 G05 |
| [IF03 Responsividade completa](specs/interface-fidelity/spec.md) | README §3/8 | 2.4, 6.1, 8.1, 8.3, 9.1, 9.5, 11.3 | E11 G05 |
| [IF04 Carregamento e feedback](specs/interface-fidelity/spec.md) | README §4/6/8 | 2.4, 7.4, 11.3 | E12 |
| [IF05 Acesso por teclado e tecnologia assistiva](specs/interface-fidelity/spec.md) | README §8 | 2.3, 2.4, 11.3 | E11 |
| [IF06 Ações auxiliares honestas](specs/interface-fidelity/spec.md) | README §1/3 | 6.3, 8.3 | E11 G05 |
| [MN01 Contratos de recursos e erros](specs/mock-network-scenarios/spec.md) | README §4/5/6 | 1.3, 3.1, 4.1, 4.2, 4.3 | G01 E01 E03 E05 E08 E12 |
| [MN02 Estado compartilhado e persistência](specs/mock-network-scenarios/spec.md) | README §6 | 3.2, 4.5, 10.3 | G03 E05 E06 |
| [MN03 Cenários determinísticos e fixtures](specs/mock-network-scenarios/spec.md) | README §6 | 3.3, 4.5 | E01 E03 E05 E07 E12 |
| [MN04 Mocks no build de demonstração](specs/mock-network-scenarios/spec.md) | README §6/12 | 4.4, 4.5, 12.3 | G01 G07 |
| [MN05 Eventos via protocolo real](specs/mock-network-scenarios/spec.md) | README §6/7 | 4.4, 4.5 | G01 E09 E10 |
| [NC01 Edição de linhas e limites](specs/nft-cart/spec.md) | README §3 | 4.1, 7.1 | E05 |
| [NC02 Persistência e merge](specs/nft-cart/spec.md) | README §3 | 3.5, 7.3 | E05 |
| [NC03 Cupom e totais precisos](specs/nft-cart/spec.md) | README §3/5 | 3.1, 4.1, 7.1, 7.2 | E05 G03 |
| [NC04 Alterações durante navegação](specs/nft-cart/spec.md) | README §3/7 | 7.4, 10.2 | E09 |
| [NC05 Estado e contagem coerentes](specs/nft-cart/spec.md) | README §3/4 | 3.3, 5.4, 7.1 | E03 E05 G05 |
| [RR01 Eventos identificados e versionados](specs/realtime-reconciliation/spec.md) | README §7 | 4.4, 10.1 | E10 G03 |
| [RR02 Atualização dos recursos ativos](specs/realtime-reconciliation/spec.md) | README §7 | 10.1 | E09 E10 |
| [RR03 Reconexão por REST](specs/realtime-reconciliation/spec.md) | README §7 | 10.2 | E10 |
| [RR04 Ciclo de vida e sessão](specs/realtime-reconciliation/spec.md) | README §3/7 | 4.4, 5.4, 10.1, 10.3 | E03 E10 |
| [RR05 Concorrência REST e evento](specs/realtime-reconciliation/spec.md) | README §4/7 | 5.1, 10.1 | E01 E10 |

## Cobertura dos cinquenta itens da inspeção

Todos têm decisão explícita em [decisions.md](decisions.md). A referência original continua em docs/figma-inspection/gaps-and-conflicts.md; a inspeção histórica não é reescrita como se as decisões já existissem no Figma.

| Item | Requisitos de aceitação | Tarefas |
| --- | --- | --- |
| C01 | NC03 IF01 | 2.1, 2.3, 3.1, 4.1, 5.2, 6.1, 6.2, 7.1, 7.2, 9.1, 11.2 |
| C02 | CD04 CO07 IF01 | 2.1, 2.3, 3.4, 4.3, 5.2, 6.1, 6.2, 7.1, 9.1, 9.5, 11.2 |
| C03 | CD04 IF01 | 2.1, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2 |
| C04 | CD04 CO07 IF01 | 2.1, 2.3, 3.4, 4.3, 5.2, 6.1, 6.2, 7.1, 9.1, 9.5, 11.2 |
| C05 | CO02 CO07 | 3.4, 4.2, 4.3, 9.2, 9.5 |
| C06 | CO02 CO07 | 3.4, 4.2, 4.3, 9.2, 9.5 |
| C07 | CS02 CS04 | 1.3, 5.2, 5.3, 5.4, 6.4, 8.3, 10.3 |
| C08 | NC05 | 3.3, 5.4, 7.1 |
| C09 | CO02 IF01 | 2.1, 2.3, 4.2, 5.2, 6.1, 6.2, 7.1, 9.1, 9.2, 11.2 |
| C10 | NC01 IF05 | 2.3, 2.4, 4.1, 7.1, 11.3 |
| C11 | NC02 NC05 DV03 | 2.1, 3.3, 3.5, 5.4, 7.1, 7.3, 11.2, 11.5 |
| C12 | CA01 | 4.2, 8.1 |
| L01 | IF03 | 2.4, 6.1, 8.1, 8.3, 9.1, 9.5, 11.3 |
| L02 | IF03 CA01 CA03 CO07 | 2.4, 3.4, 4.2, 4.3, 6.1, 8.1, 8.2, 8.3, 9.1, 9.5, 11.3 |
| L03 | CO01 IF03 | 2.4, 6.1, 8.1, 8.3, 9.1, 9.5, 11.3 |
| L04 | CD01 IF05 | 2.3, 2.4, 4.1, 6.1, 11.3 |
| L05 | CD01 IF05 | 2.3, 2.4, 4.1, 6.1, 11.3 |
| L06 | CD02 | 3.3, 6.1 |
| L07 | CD01 CD02 | 3.3, 4.1, 6.1 |
| L08 | IF06 | 6.3, 8.3 |
| L09 | CD04 IF05 | 2.3, 2.4, 6.2, 11.3 |
| L10 | CD05 | 6.3 |
| L11 | IF06 | 6.3, 8.3 |
| L12 | CD06 | 6.4 |
| L13 | NC01 NC03 | 3.1, 4.1, 7.1, 7.2 |
| L14 | CA03 | 4.2, 8.2 |
| L15 | CA03 | 4.2, 8.2 |
| L16 | CA04 CO01 | 4.2, 8.2, 9.1 |
| L17 | CO02 | 4.2, 9.2 |
| L18 | CO03 NC04 | 3.4, 7.4, 9.3, 10.2 |
| L19 | CO04 CO05 | 3.4, 4.3, 9.4, 10.2 |
| L20 | IF04 | 2.4, 7.4, 11.3 |
| L21 | CS01 CS03 | 3.2, 4.2, 5.2, 5.3, 9.4 |
| L22 | CA01 CA02 | 4.2, 8.1 |
| L23 | CS02 CS05 CO07 | 1.3, 3.4, 4.3, 5.2, 5.3, 9.5 |
| L24 | IF05 | 2.3, 2.4, 11.3 |
| L25 | IF03 IF05 | 2.3, 2.4, 6.1, 8.1, 8.3, 9.1, 9.5, 11.3 |
| L26 | CS02 CS04 | 1.3, 5.2, 5.3, 5.4, 6.4, 8.3, 10.3 |
| L27 | IF06 | 6.3, 8.3 |
| V01 | IF01 IF02 DV03 | 2.1, 2.2, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2, 11.5 |
| V02 | IF01 IF02 DV03 | 2.1, 2.2, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2, 11.5 |
| V03 | IF01 IF02 DV03 | 2.1, 2.2, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2, 11.5 |
| V04 | IF01 IF02 DV03 | 2.1, 2.2, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2, 11.5 |
| V05 | IF01 IF02 DV03 | 2.1, 2.2, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2, 11.5 |
| V06 | IF01 IF02 DV03 | 2.1, 2.2, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2, 11.5 |
| V07 | IF01 IF02 DV03 | 2.1, 2.2, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2, 11.5 |
| V08 | IF01 IF02 DV03 | 2.1, 2.2, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2, 11.5 |
| V09 | IF01 IF02 DV03 | 2.1, 2.2, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2, 11.5 |
| V10 | IF01 IF02 DV03 | 2.1, 2.2, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2, 11.5 |
| V11 | IF01 IF02 DV03 | 2.1, 2.2, 2.3, 5.2, 6.1, 6.2, 7.1, 9.1, 11.2, 11.5 |

## Limites e pendências de execução

O planejamento não promete acesso a annotations inacessíveis. O estado autoritativo das tarefas está em `tasks.md` e deve ser reconsultado quando houver mudanças. A exigência original de pixel perfect foi retirada pelo usuário, conforme `design.md`; a identidade e os comportamentos do Figma continuam como referência.

| Gate | Estado e evidência disponível |
| --- | --- |
| G01 | Verificado localmente para instalação/build e transporte no preview; [instruções de execução](../../../docs/desenvolvimento-em-andamento.md) registram a cópia isolada e seus limites. A entrega ainda exige verificação de checkout do commit final. |
| G02 | Aquisição e integridade locais revisadas em [asset-review.md](../../../docs/figma-inspection/asset-review.md), incluindo referências, fontes e arquivos dos contextos. |
| G03 | Verificado localmente: as invariantes listadas em `verification.md` foram confrontadas com as asserções de dinheiro, merge, pedidos, cotação, eventos e isolamento; 20 testes correspondentes passaram em execução direcionada, além dos 106 testes focados da execução local. O mapa e os limites estão em [reports/e2e-coverage.md](../../../reports/e2e-coverage.md). Isso não substitui G04 nem a revisão completa de rastreabilidade em 11.5. |
| G04 | Pendente: a última suíte integral teve 243 aprovados e três falhas de contraste do hero, mantido com as cores escolhidas pelo usuário. A cobertura E01–E12 e seus limites estão em [reports/e2e-coverage.md](../../../reports/e2e-coverage.md); o relatório HTML e traces foram preservados em `reports/e2e-html/`. |
| G05 | Pendente: há [revisão das referências](../../../docs/visual-verification/revisao.md), oito baselines de regressão e [auditoria de acessibilidade](../../../reports/accessibility/revisao-manual.md), mas o contraste do hero e outras verificações manuais, zoom e teclado virtual seguem abertos. |
| G06 | Doze medições do build local atual, medianas e justificativas em [reports/lighthouse/README.md](../../../reports/lighthouse/README.md). Performance mobile abaixo da meta; a publicação não é comprovada por essa coleta. |
| G07 | Pendente: URL pública e repositório correspondentes ao commit final, rotas e cenários públicos, e setup limpo da entrega ainda não foram comprovados. |

`planning-validation.json` registra apenas a validação estrutural e os hashes da etapa de planejamento. A revisão local dos critérios eliminatórios, com suas limitações, está em [reports/criterios-eliminatorios.md](../../../reports/criterios-eliminatorios.md). A tarefa 11.5 permanece aberta até a revisão completa de requisito → tarefa → evidência e o fechamento dos gates pertinentes.

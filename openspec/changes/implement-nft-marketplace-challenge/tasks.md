# Tarefas de implementação

As caixas marcadas indicam tarefas com verificação concluída; tarefas parcialmente implementadas permanecem abertas. Dependências seguem a ordem dos grupos; G01 de transporte e G02 de assets são gates antes dos fluxos visuais correspondentes. Requisitos estão em specs/; contratos/decisões e verificação integram a aceitação.

Atualização de 06/11/2026: a revisão visual segue o critério de identidade, composição, conteúdo e comportamento do Figma, sem exigir pixel perfect. Menções anteriores a coincidência exata nos documentos auxiliares não ampliam esse critério. As caixas não são automaticamente concluídas por esta mudança.

## 1. Fundação e execução

- [x] 1.1 Preservar enunciado em docs/challenge-brief.md e criar Vite/React/TypeScript, módulos e scripts; verificar que o README original continua íntegro no arquivo preservado e dev/build/preview executam. [DV01]
- [x] 1.2 Fixar Node 24/npm e dependências obrigatórias compatíveis com lockfile; registrar versões/engines/peers e comprovar npm ci, typecheck, lint e build em ambiente limpo. [DV01]
- [x] 1.3 Configurar Router, Query, Axios e env de mocks sem respostas nas features; verificar URL direta/404 e que cada tecnologia participa de um fluxo executável. [DV01 MN01 CS02]

## 2. Assets e base visual

- [x] 2.1 Priorizar o MCP do Figma para inspecionar e exportar referências F01–F15 e vetores exatos; usar a interface acessível do Figma ou o arquivo .fig preservado quando o MCP não fornecer as informações necessárias. Registrar origem e incertezas, conferir hashes, propriedades disponíveis e inventário; verificar G02 sem substitutos ou capturas usadas como UI. [IF01 IF02 DV03]
- [x] 2.2 Incluir Roboto Mono nos pesos/estilos usados e PNGs/SVGs locais com manifest de node/hash/crop/licença; verificar carregamento offline dos assets e comparação das fontes resolvidas. [IF02]
- [x] 2.3 Criar tokens e componentes shadcn adaptados, headers/divisor, footer, botões/inputs/tabs/dialog/sheet; revisar identidade, composição e variantes V01–V11 contra Figma, sem exigir igualdade de cada pixel. [IF01 IF05]
- [x] 2.4 Criar shells responsivos, scroll/sticky/safe-area e estados skeleton/shimmer/vazio/erro; verificar 390/768/1440, reduced motion e CTA alcançável com zoom/teclado. [IF03 IF04 IF05]

## 3. Contratos e repositório da simulação

- [x] 3.1 Implementar schemas/DTOs de contracts.md e Money em wei; verificar parse de 18 casas, multiplicação, cupom 10% truncado, taxa e totais sem float com testes focados. [MN01 NC03]
- [x] 3.2 Criar IndexedDB transacional/versionada com sessões, usuários hash, catálogo, cart, quotes, account, orders/reservas/ledger; verificar commit/rollback e erro/reset sem fallback silencioso. [MN02 CS01]
- [x] 3.3 Criar seed de 36 NFTs/2 usuários/4 artes, identidades canônicas, cenários desktop/mobile e clock controlável; verificar filtros/paginação e que resize não altera fixture. [MN03 NC05 CD02]
- [x] 3.4 Implementar quote/revisões/TTL, estoque/reserva e idempotência com snapshot/hash do payload/ledger; verificar mesma chave em concorrência, conflito de conteúdo, reservas e terminais. [CO03 CO04 CO05 CO06 CO07]
- [x] 3.5 Implementar merge idempotente e consumo por lineId capturado; verificar retry de merge e confirmação preservando acréscimos/linhas recriadas. [NC02 CO06]

## 4. Rede MSW e prova de transporte

- [x] 4.1 Criar handlers REST catálogo/detalhe/favoritos/cart/cupom/quotes, status/erros/versões; verificar operações reais Axios/MSW e contratos/isolamento previstos. [MN01 CD01 CD03 NC01 NC03]
- [x] 4.2 Criar handlers REST auth/session/profile/avatar/wallets/connections com validação e commit atômico; verificar hashes, expiração, 403/409/422 e persistência. [MN01 CS01 CS03 CA01 CA02 CA03 CA04 CO02]
- [x] 4.3 Criar handlers de pedido/create/attempt lookup/state com processamento de vencimentos; verificar timeout após commit recuperando mesmo pedido e efeitos únicos. [MN01 CO04 CO05 CO06 CO07]
- [x] 4.4 Inicializar MSW antes dos clientes, integrar binding Socket.IO WebSocket-only, outbox entre abas e session.bind/subscribe autorizado; provar handshake/nft.updated/order.updated/reconnect no preview otimizado (G01), sem callbacks no cache. [MN04 MN05 RR01 RR04]
- [x] 4.5 Criar seleção/reset/controles e todos os cenários de contracts.md, latência/erros/clock/events; verificar reset integral e reprodução determinística de cada cenário, sem import de mocks por features. [MN02 MN03 MN04 MN05]

## 5. Sessão e fronteira de dados

- [x] 5.1 Implementar query keys, cancelamento, watermark, cache/retries D06 e validação das respostas; verificar resposta antiga/filtro antigo não sobrescrevendo resultado atual. [CD03 RR05 DV05]
- [x] 5.2 Implementar login/cadastro desktop/mobile, validação/erros/conflito/toggle e returnTo seguro; comparar F06/F07/F14/F15 e verificar retorno ao cart/checkout sem carteira obrigatória no signup. [CS01 CS02 CS05 IF01]
- [x] 5.3 Implementar bootstrap da sessão, guards/401 single transition e retomada pelo mesmo owner; verificar refresh/expiração no checkout conservando tentativa original. [CS02 CS03]
- [x] 5.4 Implementar logout/troca de conta/múltiplas abas, teardown de requests/listeners/caches/drafts e visitor novo; verificar nenhuma resposta/evento/dado de A exposto a B. [CS04 NC05 RR04]

## 6. Descoberta e favoritos

- [x] 6.1 Implementar home desktop/mobile com todos os blocos fornecidos, catálogo/query URL/filtros/ordenação/paginação/drawer/search; comparar F01/F10 e executar E01 com histórico e respostas fora de ordem. [CD01 CD02 CD03 IF01 IF03]
- [x] 6.2 Implementar detalhe/galeria/zoom/edições/stepper/metadados/abas/relacionados e 404; comparar F02/F11, incluindo sobreposição e limites de estoque de E02. [CD04 IF01]
- [x] 6.3 Implementar Comprar/Adicionar e auxiliares/indicadores conforme decisões; verificar payload da seleção, destino após sucesso e feedback honesto sem funcionalidade extra. [CD05 IF06]
- [x] 6.4 Implementar favoritos privados com lista em grid, otimista/rollback protegido; verificar E04, refresh, falha e troca de usuário sem vazamento. [CD06 CS04]

## 7. Carrinho e cotação

- [x] 7.1 Implementar tabela/cards, stepper, remoção em todos os itens, vazio e badge soma; comparar F03/F12 com desvios C01/C02/C08/C10 e verificar limites/refresh. [NC01 NC03 NC05 IF01]
- [x] 7.2 Implementar cupom/apply/remove/erro e resumo de valores retornados pela API; verificar E05 inválido/expirado/desconto/taxa e precisão decimal. [NC03]
- [x] 7.3 Integrar merge após autenticação com ajustes e retry seguro; verificar carrinho visitante preservado e merge repetido sem duplicar. [NC02]
- [x] 7.4 Integrar atualização de preço/estoque no cart, feedback e quote invalidada; verificar E09 sem liberar checkout obsoleto e E12 no loading/erro do resumo. [NC04 IF04]

## 8. Conta do colecionador

- [x] 8.1 Implementar perfil/avatar staged/senha/Salvar atômico e mobile derivado; comparar F08 e verificar E08 com erros, refresh e nova senha funcionando. [CA01 CA02 IF03]
- [x] 8.2 Implementar carteiras principal/secundária, expandir/copy draft/selects/validação; comparar F09 e verificar E08 com persistência e uso em checkout. [CA03 CA04]
- [x] 8.3 Implementar menu privado/favoritos/logout e auxiliares honestos em todos os tamanhos; verificar teclado e destinos previstos sem novas páginas excluídas. [IF03 IF06 CS04]

## 9. Checkout e pedidos

- [x] 9.1 Implementar dados/revisão desktop e dois passos mobile com Revisar Sheet; comparar F04/F13 e verificar todos os campos/itens/totais consultáveis antes do envio. [CO01 IF01 IF03]
- [x] 9.2 Integrar wallets cadastradas, rede/provedor e conexão/recusa/desconexão; verificar seleção/rede correspondentes, troca e bloqueio desconectado. [CO02]
- [x] 9.3 Integrar revalidação de quote e comparação com aceite, inclusive TTL e eventos; verificar que preço/estoque/cupom/taxa alterados exigem novo clique explícito. [CO03]
- [x] 9.4 Persistir tentativa antes de POST, bloquear duplo clique, recuperar por chave após timeout/refresh/expiração/reconnect e representar pending/declined; verificar E07 e estado terminal único. [CO04 CO05 CS03]
- [x] 9.5 Implementar recibo desktop/mobile do snapshot, explorador simulado e fechamento seguro; comparar F05 e verificar E06, cart consumido parcialmente e recibo imutável após mudanças. [CO06 CO07 IF03]

## 10. Sincronização e ciclo de vida

- [x] 10.1 Integrar envelopes/dedup/watermarks/owner/geração/terminalidade aos recursos ativos; verificar E09/E10 contra duplicatas, eventos antigos e REST atrasado. [RR01 RR02 RR04 RR05]
- [x] 10.2 Reconciliar REST após reconnect/foco/refresh e rebind antes de habilitar confirmação; verificar evento perdido e pending resolvido durante desconexão sem nova compra. [RR03 CO05 NC04]
- [x] 10.3 Concluir cleanup em unmount/StrictMode/logout/reset e múltiplas abas; verificar contagem estável de listeners/subscriptions e evento de sessão anterior descartado. [RR04 CS04 MN02]

## 11. Qualidade e evidências

- [ ] 11.1 Executar testes focados das invariantes G03 e E01–E12 completos nos dois perfis Chromium com clocks/latências/eventos controlados; verificar relatório HTML e traces em falhas por UI/rede. [DV02]
- [ ] 11.2 Revisar F01–F15 contra a fonte, registrar omissões e divergências relevantes e versionar baselines de home/detalhe/cart/pagamento nos perfis exigidos; verificar G05 sem exigir pixel perfect ou ocultar defeitos. [DV03 IF01]
- [ ] 11.3 Auditar teclado/foco/labels/contraste/feedback e 390/768/1440/414, zoom/reflow/teclado virtual/reduced motion para nove telas; verificar E11/E12 e corrigir perdas de conteúdo. [IF03 IF04 IF05]
- [x] 11.4 Otimizar build/rotas/assets/fontes sem retirar funcionalidades, versionar configuração Lighthouse e executar 12 medições; entregar HTML/JSON/medianas/LCP/CLS/TBT/ambiente e justificar abaixo das metas (G06). [DV04]
- [ ] 11.5 Revisar rastreabilidade requisito→tarefa→evidência real e critérios eliminatórios; verificar G01–G06 sem requisito omitido nem tarefa marcada apenas por existência de documento. [DV01 DV02 DV03 DV04]

## 12. Documentação e publicação

- [ ] 12.1 Escrever README setup/env/credenciais fictícias/seleção/reset/comandos/reprodução de falhas; verificar instruções em checkout limpo e todos os scripts G07. [DV01 DV05]
- [ ] 12.2 Escrever ARCHITECTURE com REST/eventos/sessão/cart/cache/retries/reconciliação/limites/decisões/desvios; verificar correspondência com comportamento implementado e os 50 itens C/L/V. [DV05]
- [ ] 12.3 Configurar e publicar build estático Vercel com mocks e fallback sem interceptar assets/SW; registrar repo/appURL/commit/build e verificar rotas diretas/refresh no público. [DV06 MN04]
- [ ] 12.4 Executar G07 na URL publicada, incluindo compra confirmada/recusada, timeout, reconexão e reset; entregar relatório público e correspondência com código, sem declarar pronto com gate pendente. [DV06]

# Plano de verificação e critérios de saída

Isto é plano de aceitação, não relatório de execução. Nenhum teste, tela ou deploy está concluído pela existência deste documento. Fonte: README §§8–12. Execução deve produzir evidências do mesmo código entregue.

## Gates em ordem

1. **G01 instalação/transporte:** checkout limpo, Node 24 fixado, npm ci, typecheck/lint/build; MSW inicializa antes dos clientes; socket.io-client conecta via binding, recebe nft.updated/order.updated e reconecta no preview de produção. Registrar versões/peers e frames de transporte. Se falhar, resolver antes de construir fluxos; não substituir por callbacks.
2. **G02 assets/referências:** quinze referências limpas e manifest de assets/propriedades; SVGs/fontes locais; fonte congelada íntegra. Cada tela depende dos seus assets, sem similar provisório aceito como final.
3. **G03 invariantes:** dinheiro em wei (inclui 18 casas, qty, desconto, taxa e arredondamento), merge idempotente, reserva/ledger/consumo por lineId, idempotência concorrente, revisão/fingerprint, terminais e isolamento/versão. Testes focados quando E2E não distingue todos os interleavings.
4. **G04 E2E:** os doze grupos abaixo, Chromium desktop 1440×900/mobile 390×844; teste responsivo adicional 768×1024 e referência 414×896. Context isolado por teste, reset conhecido e relógio/latência/eventos controlados. Testes observam UI e respostas da rede; controles não acessam cache/setters.
5. **G05 visual/acessibilidade:** F01–F15 comparados com origem e registro de desvios; regressão versionada de home/detalhe/cart/pagamento nos dois perfis. Teclado, foco, contraste, zoom 200%/reflow 400%, reduced motion, scroll/teclado virtual e todos os nove fluxos em 390/768/1440. Não regenerar baseline para aprovar defeito.
6. **G06 auditoria:** build otimizado com mock default; início/detalhe × mobile/desktop ×3=12 medições, configuração versionada, mediana por categoria e LCP/CLS/TBT. Metas Performance 90, Accessibility 95, Best Practices 95, SEO 90; abaixo exige causa e justificativa como manda o enunciado, nunca redução exclusiva para audit.
7. **G07 entrega pública:** commit/build e lockfile identificados, repositório acessível à avaliação e app público acessível; testar links diretos/refresh para todas as rotas, MSW/SW/assets, compra confirmada/recusada, timeout e Socket.IO. README/ARCHITECTURE/report HTML/traces e auditorias presentes; repetir setup em checkout limpo sem backend privado.

## Doze grupos E2E do enunciado

| ID | Ações e asserções obrigatórias | Cenários |
| --- | --- | --- |
| E01 | Busca e filtros combinados enviados à API; OR/AND/faixa; sort; página 2; filtro reinicia em 1; refresh/back/forward; primeiro resultado atrasado não substitui último. | default, empty, out-of-order |
| E02 | Acesso direto, galeria/zoom, edição esgotada e limite; NFT 404; rota 404 recuperável; comprar vs adicionar. | default, sold-out, http-404 |
| E03 | Cadastro/login/erros/conflito; recuperar sessão; expirar durante navegação e checkout; retornar contexto; logout/trocar usuário limpa cache/listeners/drafts anteriores. | signup-conflict, session-expired, http-401/403 |
| E04 | Favoritar otimista visível, falha faz rollback sem reverter clique/operação posterior; refresh persiste e usuário B não vê A. | default, favorite-failure |
| E05 | Quantidade/limites/remoção todos os itens; cupom aplicar/remover/inválido/expirado; valores precisos; refresh; merge após login repetido sem duplicação/perda. | visual-desktop, visual-mobile, coupon-invalid/expired |
| E06 | Catálogo→detalhe→cart→login→checkout, dados completos e revisão, carteira salva/rede/conectar, pedido pending e confirmed, recibo do snapshot, apenas quantidade comprada removida. | payment-confirmed |
| E07 | Conexão recusada/desconexão, pagamento recusado preserva cart; duplo clique/duas abas/chave com conteúdo diferente; timeout após commit lookup do mesmo pedido; unknown não permite tentativa nova automática. | payment-declined, timeout-after-order-create |
| E08 | Perfil e avatar/senha atômicos com erros; refresh; senha antiga não autentica após troca; adicionar/editar principal/secundária/cópia; carteiras disponíveis no checkout. | validation-errors, default |
| E09 | NFT no cart; update via cliente Socket.IO altera preço/estoque/cupom/taxa, informa e atualiza resumo; revisão antiga bloqueada; nova confirmação explícita. | price-change, sold-out, fee-change |
| E10 | Duplicata/antigo não regride/aplica efeito; conexão cortada pending, novo estado no DB enquanto desconectado, reconnect/refresh REST recupera mesmo pedido; evento de A após troca para B ignorado; terminais imutáveis. | duplicate-old-events, pending-disconnect |
| E11 | Fluxo por teclado, foco visível, trap/Escape/restauração de auth/filter/gallery/review; labels/erros/aria-live, zoom/reflow sem perda; auxiliares honestos. | default, validation-errors |
| E12 | Shimmer em catálogo/detalhe/resumo com tamanho estável; reduced motion; erro/retry; atualização em segundo plano preserva conteúdo; requests 4xx/5xx/offline/timeout recuperam sem duplicar mutations. | slow, network-error, http-400/409/422/500/503 |

Cobertura extra: preço em 18 casas e sem float; pedido confirmado recarregado após mudança de arte/preço/wallet mantém recibo; edição no carrinho durante pendência conserva acréscimos e linhas recriadas; stale REST contra evento novo; strict-mode mount/unmount sem listeners duplicados; reset integral e múltiplas abas; cotação expirada entre revisar/enviar; reconciliação obrigatória antes de habilitar confirmação; returnTo externo recusado.

## Evidências produzidas durante implementação

- Scripts npm: `dev:mock`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:e2e`, `test:visual`, `audit:lighthouse`. README documenta instalação de Chromium e seleção/reset/controle dos cenários.
- `tests/visual/` contém baselines aprovadas e manifest de desvios; `docs/visual-verification/` contém comparação por F01–F15 com referência, app e diff. Screenshots não substituem DOM/controles.
- Playwright HTML report e traces em falhas, requests/eventos do transporte comprovados sem bodies de senha em logs customizados. Fixar browser/fontes/DPR/clock; aguardar fontes e imagens, não sleep arbitrário para estabilizar UI.
- `reports/lighthouse/` contém 12 HTML + 12 JSON, tabela de medianas, LCP/CLS/TBT, versões do Lighthouse/Chrome/Node, OS/CPU, rede/throttling/config e horários. Reset default antes de cada execução; primeira visita com inicialização real dos mocks, sem excluir assets/fontes/funções para pontuar.
- `ARCHITECTURE.md`: contratos, sessão/expiração/retomada, merge/carrinho/dinheiro, cache/retries/cancelamento, eventos/transporte/limites/reconciliação, decisões C/L/V e adaptações móveis, limites IndexedDB sem segurança de backend real.
- `docs/delivery-verification.md`: commit/build/config, URLs repositório/app, resultado de G01–G07, reprodução pública de sucesso/falhas e disponibilidade das rotas/assets. Não publicar relatórios de resultado inventados.

## Condição de pronto

Todos os requisitos da change e gates têm evidência. Falha visual, asset não obtido, ausência de deploy, compra sem confirmação de servidor, vazamento entre usuários, callbacks no lugar de Socket.IO, stack decorativa ou E2E não executável impedem conclusão. Abaixo das metas Lighthouse exige diagnóstico/justificativa explícita, não falsa afirmação de aprovação. Planejamento concluído não equivale a aplicação aprovada.

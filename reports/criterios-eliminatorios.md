# Verificação dos critérios eliminatórios — em andamento

Revisão local de 06/11/2026. As evidências abaixo dizem respeito ao estado de trabalho e à execução indicada; não comprovam o commit ou a publicação final.

| Critério do desafio | Evidência local inspecionada | Limite |
| --- | --- | --- |
| Uso efetivo da stack obrigatória | `src/main.tsx` monta Query e Router; `src/app/router.tsx` define rotas; `vite.config.ts` integra Tailwind; `src/components/ui/` usa primitivas Radix adaptadas; `src/shared/http.ts` usa Axios; `src/mocks/` fornece MSW e o binding Socket.IO. Os scripts de build, Playwright e Lighthouse estão em `package.json`. | A inspeção de imports não substitui a verificação dos fluxos e do build publicado. |
| Fluxos principais não são apenas visuais | `tests/e2e/purchase-responsive.spec.ts` percorre descoberta, carrinho, autenticação, carteira, revisão, criação de pedido e recibo em 390/1440; os testes de conta e carrinho estão em [e2e-coverage.md](e2e-coverage.md). | Os dados são simulados no navegador, conforme o desafio; outras combinações e o ambiente público ainda exigem validação. |
| Confirmação depende da simulação | `src/features/orders/OrderPage.tsx` distingue `pending`, `declined` e `confirmed`; os testes `purchase-responsive.spec.ts`, `checkout-recovery-ui.spec.ts` e `order-repository.test.ts` verificam pedido, recuperação e terminalidade. | A conclusão no mock não é transação real; a execução publicada ainda não foi verificada. |
| Sem exposição entre usuários | `favorites-responsive.spec.ts` troca A por B em 390/1440; `order-owner-replay.spec.ts` verifica isolamento do pedido e do evento anterior; `private-read-race.test.ts` cobre revogação durante leitura. | Evidência local de cenários específicos não prova segurança de um serviço real, que não faz parte da solução. |
| Eventos passam pelo Socket.IO e MSW | `preview-realtime.spec.ts` verifica WebSocket, bind, assinatura autorizada, `nft.updated`, `order.updated` e reconexão no build; os cinco testes de preview também passaram em uma cópia isolada. | O transporte e seu escopo são simulados; a URL pública ainda precisa ser testada. |
| Testes E2E executáveis | A última suíte integral registrou 243 aprovados e três falhas; [HTML e traces](e2e-html/index.html) e [limites de cobertura](e2e-coverage.md) estão preservados. | Três falhas de contraste do hero permanecem com as cores mantidas por decisão do usuário. Os cinco erros de espaço de execução anterior não se repetiram. |

O estado dos gates G01–G07 continua em [traceability.md](../openspec/changes/implement-nft-marketplace-challenge/traceability.md). A tarefa 11.5 permanece aberta até fechar as lacunas de G04/G05 e concluir a revisão dos critérios; a publicação e sua comprovação pertencem às tarefas 12.3 e 12.4.

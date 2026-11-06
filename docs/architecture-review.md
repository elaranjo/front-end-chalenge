# Revisão da arquitetura em andamento

Esta revisão relaciona as decisões de `decisions.md` aos pontos de implementação e às verificações existentes. Os arquivos indicados são pontos de partida para auditoria, não uma afirmação de que cada detalhe da decisão foi comprovado. O resultado integral e seus limites estão em [cobertura E2E](../reports/e2e-coverage.md), [revisão visual](visual-verification/revisao.md) e [acessibilidade](../reports/accessibility/revisao-manual.md).

## Decisões C01–C12

| Decisões | Implementação a revisar | Evidência existente e limite |
| --- | --- | --- |
| C01, C02, C08, C10, C11 | `src/mocks/catalog-seed.ts`, `cart-repository.ts`, `src/features/cart/CartPage.tsx`, cabeçalhos | `cart-responsive.spec.ts`, `cart-merge-ui.spec.ts` e `cart-badge-contrast.spec.ts` verificam quantidades, remoção, merge e contraste em cenários determinados. Valores dos frames e identidade estão na revisão visual; isso não cobre todas as combinações. |
| C03, C04 | `src/features/catalog/DetailPage.tsx`, `src/mocks/catalog-seed.ts` | `detail-mobile.spec.ts`, `detail-responsive-flow.spec.ts` e `catalog-seed.test.ts` verificam edições, ações e dados; a correspondência visual é tratada na revisão dos frames. |
| C05, C06 | `src/features/orders/OrderPage.tsx`, `src/mocks/order-repository.ts` | `order-reference.spec.ts` e `order-repository.test.ts` verificam snapshot e efeitos do pedido; não comprovam transferência real. |
| C07 | `src/features/account/AccountHeader.tsx`, `src/features/catalog/HomePage.tsx` | `header-ui.spec.ts` verifica apresentação e navegação dos cabeçalhos no cenário executado. |
| C09 | `src/features/checkout/CheckoutPage.tsx` | `checkout-ui.spec.ts` seleciona WalletConnect; outros provedores e estados estão distribuídos pelos testes de checkout. |
| C12 | `src/features/account/ProfilePage.tsx`, `src/mocks/profile-handlers.ts` | `profile-ui.spec.ts`, `profile-avatar.spec.ts` e `account-responsive-flow.spec.ts` exercitam validação e persistência; o fluxo depende do armazenamento simulado. |

## Decisões L01–L27

| Decisões | Implementação a revisar | Evidência existente e limite |
| --- | --- | --- |
| L01, L02, L03 | estilos e páginas de `catalog`, `account`, `checkout` e `orders` | `reflow.spec.ts`, `account-responsive-flow.spec.ts` e `checkout-ui.spec.ts` exercitam larguras e passos selecionados. A auditoria de nove fluxos e teclado virtual segue aberta. |
| L04, L05, L06, L07 | `HomePage.tsx`, `CatalogFilters.tsx`, `src/shared/catalog-location.ts` | `home-catalog.spec.ts` e `catalog-combined.spec.ts` cobrem busca, filtros e navegação; a matriz integral está sujeita aos limites de E01. |
| L08, L09, L10, L11 | `HomePage.tsx`, `DetailPage.tsx` | `home-catalog.spec.ts` e `detail-responsive-flow.spec.ts` verificam ações e galeria em cenários específicos. |
| L12, L13 | `src/features/favorites`, `src/features/cart` | `favorites-responsive.spec.ts`, `favorites-ui.spec.ts` e `cart-responsive.spec.ts` cobrem persistência, falhas e carrinho; não substituem toda a matriz de erros. |
| L14, L15, L16 | `src/features/account/WalletsPage.tsx`, `src/mocks/wallet-handlers.ts` | `wallets.spec.ts`, `account-responsive-flow.spec.ts` e `wallet-api.test.ts` cobrem formulários, slots e validação em cenários determinados. |
| L17, L18, L19 | `src/features/checkout`, `src/features/orders`, `src/mocks/order-repository.ts` | `quote-responsive.spec.ts`, `checkout-recovery-ui.spec.ts`, `pending-disconnect.spec.ts` e `order-repository.test.ts` exercitam conexão, recusa e recuperação simuladas. |
| L20, L21, L22 | `src/features/shared/LoadingSkeleton.tsx`, `src/features/auth`, `src/features/account/ProfilePage.tsx` | `loading-ui.spec.ts`, `auth-responsive-flow.spec.ts`, `profile-avatar.spec.ts` e `account-responsive-flow.spec.ts` cobrem estados selecionados. |
| L23, L24, L25 | `src/app/router.tsx`, `src/shared/safe-return.ts`, diálogos e estilos responsivos | `safe-return.test.ts`, `router-fallback.spec.ts`, `auth-desktop.spec.ts`, `detail-responsive-flow.spec.ts` e `checkout-ui.spec.ts` cobrem partes de navegação e foco. Outros acionadores, teclado virtual real e estados de zoom permanecem em revisão. |
| L26, L27 | `AccountHeader.tsx`, `AccountNavigation.tsx`, `Footer.tsx`, `OrderPage.tsx` | `header-ui.spec.ts`, `account-menu-mobile.spec.ts`, `home-catalog.spec.ts` e `checkout-ui.spec.ts` verificam parte da navegação e ações honestas. |

## Decisões V01–V11

| Decisões | Implementação e evidência a revisar | Limite |
| --- | --- | --- |
| V01, V02, V03, V05, V10 | estilos em `src/features/catalog/` e `src/features/layout/`; comparação de F01/F02/F10/F11 em [revisão visual](visual-verification/revisao.md) | A revisão adotou identidade e composição, sem exigir pixel perfect. As cores originais do hero foram mantidas por decisão do usuário apesar do contraste medido. |
| V04, V06, V07, V08, V09 | `src/features/auth/`, `src/features/orders/`; F05–F07 e F14–F15 | `auth-desktop.spec.ts` verifica modal e conteúdo decorativo; a revisão visual registra os estados e não comprova todas as alturas e interações. |
| V11 | `src/features/` e [font-assets.md](font-assets.md) | `local-fonts.spec.ts` verifica carregamento local nos estados executados; isso não comprova equivalência de todas as métricas tipográficas. |

## Contratos e ciclo de vida

Em 06/11/2026, a revisão dos handlers confirmou as famílias REST listadas em [ARCHITECTURE.md](../ARCHITECTURE.md), inclusive perfil/avatar, carteiras/conexões, pedidos, catálogo, favoritos, carrinho e sessão. `src/app/query-client.ts` confirma os valores documentados de `staleTime`, `gcTime`, retry e backoff padrão; os recursos com política específica estão em `src/shared/cart-queries.ts`, `private-queries.ts` e `checkout-quote.ts`. `src/shared/http.ts` fixa o timeout Axios em 10 segundos.

Essa conferência é estática. A entrega ainda requer revisão integral requisito por requisito e execução dos gates pendentes; ela não substitui um checkout do commit final nem testes da URL pública.

## Conferência documental de decisões

Em 06/11/2026, a conferência dos identificadores verificou que as 50 decisões C01–C12, L01–L27 e V01–V11 de `decisions.md` aparecem individualmente nesta revisão. Essa checagem prova apenas a presença dos identificadores, não a correção das evidências ou a conclusão da tarefa 12.2.

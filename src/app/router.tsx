import { lazy, Suspense } from 'react'
import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { HomePage } from '../features/catalog/HomePage.tsx'
import { DetailPage } from '../features/catalog/DetailPage.tsx'
import { CartMergeNotice } from '../features/cart/CartMergeNotice.tsx'
import { LogoutNotice } from '../features/account/LogoutNotice.tsx'
import { sessionManager } from './session.ts'
import { requireSession } from '../shared/route-guard.ts'

const AuthPage = lazy(() => import('../features/auth/AuthPage.tsx').then((module) => ({ default: module.AuthPage })))
const CartPage = lazy(() => import('../features/cart/CartPage.tsx').then((module) => ({ default: module.CartPage })))
const WalletsPage = lazy(() => import('../features/account/WalletsPage.tsx').then((module) => ({ default: module.WalletsPage })))
const ProfilePage = lazy(() => import('../features/account/ProfilePage.tsx').then((module) => ({ default: module.ProfilePage })))
const FavoritesPage = lazy(() => import('../features/favorites/FavoritesPage.tsx').then((module) => ({ default: module.FavoritesPage })))
const CheckoutPage = lazy(() => import('../features/checkout/CheckoutPage.tsx').then((module) => ({ default: module.CheckoutPage })))
const OrderPage = lazy(() => import('../features/orders/OrderPage.tsx').then((module) => ({ default: module.OrderPage })))

const rootRoute = createRootRoute({
  component: () => <><CartMergeNotice /><LogoutNotice /><Suspense fallback={<main role="status">Carregando...</main>}><Outlet /></Suspense></>,
  notFoundComponent: () => <main><h1>Página não encontrada</h1><a href="/">Voltar ao início</a></main>,
})
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: () => <AuthPage mode="login" /> })
const signupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/signup', component: () => <AuthPage mode="signup" /> })
const cartRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cart', component: CartPage })
const walletsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/wallets', beforeLoad: ({ location }) => requireSession(sessionManager.session, location.href), component: WalletsPage })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/profile', beforeLoad: ({ location }) => requireSession(sessionManager.session, location.href), component: ProfilePage })
const favoritesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/favorites', beforeLoad: ({ location }) => requireSession(sessionManager.session, location.href), component: FavoritesPage })
const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/checkout', beforeLoad: ({ location }) => requireSession(sessionManager.session, location.href), component: CheckoutPage })
const orderRoute = createRoute({ getParentRoute: () => rootRoute, path: '/orders/$orderId', beforeLoad: ({ location }) => requireSession(sessionManager.session, location.href), component: () => { const { orderId } = orderRoute.useParams(); return <OrderPage orderId={orderId} /> } })
const detailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/nfts/$nftId', component: () => { const { nftId } = detailRoute.useParams(); return <DetailPage key={nftId} nftId={nftId} /> } })
function parseSearch(search: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  for (const [key, value] of new URLSearchParams(search)) {
    const previous = result[key]
    result[key] = previous === undefined ? value : Array.isArray(previous) ? [...previous, value] : [previous, value]
  }
  return result
}
function stringifySearch(search: Record<string, unknown>): string {
  const result = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue
    for (const item of Array.isArray(value) ? value : [value]) result.append(key, String(item))
  }
  const encoded = result.toString()
  return encoded ? `?${encoded}` : ''
}
export const router = createRouter({ parseSearch, stringifySearch, routeTree: rootRoute.addChildren([indexRoute, loginRoute, signupRoute, detailRoute, cartRoute, walletsRoute, profileRoute, favoritesRoute, checkoutRoute, orderRoute]) })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

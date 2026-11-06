import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`an old order event cannot expose account A after switching to B at ${width}px`, async ({ page }) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('http://127.0.0.1:5173/')
    await expect(page.locator('.home-card').first()).toBeVisible()
    expect(await page.evaluate(async () => (await fetch('/api/v1/__mock/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'pending-disconnect', clockMode: 'manual' }) })).ok)).toBe(true)
    await page.goto('http://127.0.0.1:5173/login?returnTo=%2Fcheckout')
    await page.getByLabel('E-mail', { exact: true }).fill('colecionador.a@kurio.test')
    await page.getByLabel('Senha', { exact: true }).fill('DemoA!2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/checkout$/)
    await page.evaluate(async () => {
      const token = localStorage.getItem('kurio.session-token')!
      const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      const wallet = { displayName: 'Colecionador', nickname: 'Principal', network: 'ethereum', profileName: 'Perfil', address: `0x${'a'.repeat(40)}`, type: 'metamask', referralCode: 'DEMO', email: 'a@kurio.test', ensName: 'colecionador' }
      const saved = await fetch('/api/v1/wallets/primary', { method: 'PUT', headers: { ...auth, 'If-Match': '0' }, body: JSON.stringify(wallet) })
      if (!saved.ok) throw new Error(`wallet ${saved.status}`)
      const added = await fetch('/api/v1/cart/items', { method: 'POST', headers: { ...auth, 'If-Match': '0', 'X-Mutation-Id': crypto.randomUUID() }, body: JSON.stringify({ nftId: 'emerald-ape-042', editionId: 'one-of-fifty', quantity: 1 }) })
      if (!added.ok) throw new Error(`cart ${added.status}`)
    })
    await page.reload()
    await page.getByLabel(/Carteira principal — Principal/).click()
    if (width < 1280) await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByRole('button', { name: 'Conectar carteira', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Compra em processamento' })).toBeVisible()
    const orderId = new URL(page.url()).pathname.split('/').at(-1)!
    await page.evaluate(async (id) => {
      const { createSocket } = await import('/src/realtime/socket.ts')
      const socket = createSocket(location.origin)
      const once = (event: string) => new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout ${event}`)), 8000)
        socket.once(event, () => { clearTimeout(timer); resolve() })
      })
      socket.on('order.updated', (event: { eventId: string }) => Object.assign(window, { priorOwnerEvent: event.eventId }))
      socket.connect(); await once('connect')
      const ready = once('session.ready'); socket.emit('session.bind', { token: localStorage.getItem('kurio.session-token'), nonce: crypto.randomUUID() }); await ready
      const subscribed = once('resources.subscribed'); socket.emit('resources.subscribe', { catalog: false, nftIds: [], orderIds: [id] }); await subscribed
    }, orderId)
    expect(await page.evaluate(async () => (await fetch('/api/v1/__mock/clock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ advanceMs: 2000 }) })).ok)).toBe(true)
    await expect.poll(() => page.evaluate(() => (window as unknown as { priorOwnerEvent?: string }).priorOwnerEvent)).toBeTruthy()
    const eventId = await page.evaluate(() => (window as unknown as { priorOwnerEvent: string }).priorOwnerEvent)
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await page.goto('http://127.0.0.1:5173/profile')
    if (width < 1280) await page.getByRole('button', { name: 'Meu perfil', exact: true }).click()
    await page.getByRole('button', { name: 'Sair', exact: true }).click()
    await page.goto(`http://127.0.0.1:5173/login?returnTo=${encodeURIComponent(`/orders/${orderId}`)}`)
    await page.getByLabel('E-mail', { exact: true }).fill('colecionador.b@kurio.test')
    await page.getByLabel('Senha', { exact: true }).fill('DemoB!2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Não foi possível carregar o pedido.')
    const result = await page.evaluate(async ({ id, eventId }) => {
      const { createSocket } = await import('/src/realtime/socket.ts')
      const socket = createSocket(location.origin)
      const once = (event: string) => new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout ${event}`)), 8000)
        socket.once(event, (value: unknown) => { clearTimeout(timer); resolve(value) })
      })
      let orders = 0
      socket.on('order.updated', () => { orders++ })
      try {
        socket.connect(); await once('connect')
        const ready = once('session.ready'); socket.emit('session.bind', { token: localStorage.getItem('kurio.session-token'), nonce: crypto.randomUUID() }); await ready
        const subscribed = once('resources.subscribed'); socket.emit('resources.subscribe', { catalog: true, nftIds: [], orderIds: [id] }); const ack = await subscribed
        const replay = await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'emitDuplicate', payload: { eventId } }) })
        if (!replay.ok) throw new Error(`replay ${replay.status}`)
        const marker = once('nft.updated')
        const updated = await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateNft', payload: { nftId: 'golden-beat-207', editionId: 'one-of-ten', unitPrice: '2.75' } }) })
        if (!updated.ok) throw new Error(`marker ${updated.status}`)
        await marker
        return { allowed: ack.orderIds, orders }
      } finally { socket.disconnect() }
    }, { id: orderId, eventId })
    expect(result.allowed).toEqual([])
    expect(result.orders).toBe(0)
    await expect(page.getByRole('alert')).toContainText('Não foi possível carregar o pedido.')
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toHaveCount(0)
  })
}

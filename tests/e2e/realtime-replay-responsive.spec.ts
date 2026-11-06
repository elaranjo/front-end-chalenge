import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test(`duplicate and older events do not regress cart price at ${width}px`, async ({ page }) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      const events: Array<{ eventId: string; version: number }> = []
      ;(window as unknown as { observedNftEvents: typeof events }).observedNftEvents = events
      const original = EventTarget.prototype.dispatchEvent
      EventTarget.prototype.dispatchEvent = function (event: Event) {
        if (event instanceof MessageEvent && typeof event.data === 'string' && event.data.startsWith('42') && 'url' in this && typeof this.url === 'string' && this.url.includes('/socket.io/')) {
          try {
            const frame = JSON.parse(event.data.slice(2))
            if (Array.isArray(frame) && frame[0] === 'nft.updated' && typeof frame[1]?.eventId === 'string' && typeof frame[1]?.version === 'number') events.push({ eventId: frame[1].eventId, version: frame[1].version })
          } catch { /* Non-event frames are irrelevant to this observation. */ }
        }
        return original.call(this, event)
      }
    })
    await page.goto('http://127.0.0.1:5173/cart?mockScenario=visual-mobile')
    const item = page.locator('.cart-line').filter({ hasText: 'Emerald Ape #042' })
    await expect(item.locator('b')).toHaveText('1.19 ETH')
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeEnabled()
    const action = (body: object) => page.evaluate(async (value) => {
      const response = await fetch('/api/v1/__mock/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
      if (!response.ok) throw new Error(`action ${response.status}`)
      return response.json()
    }, body)
    await action({ action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-fifty', unitPrice: '1.50' } })
    await expect(item.locator('b')).toHaveText('1.5 ETH')
    await expect.poll(() => page.evaluate(() => (window as unknown as { observedNftEvents: unknown[] }).observedNftEvents.length)).toBeGreaterThanOrEqual(1)
    const original = await page.evaluate(() => (window as unknown as { observedNftEvents: Array<{ eventId: string; version: number }> }).observedNftEvents[0])
    await action({ action: 'updateNft', payload: { nftId: 'emerald-ape-042', editionId: 'one-of-fifty', unitPrice: '2.50' } })
    await expect(item.locator('b')).toHaveText('2.5 ETH')
    await expect.poll(() => page.evaluate(() => (window as unknown as { observedNftEvents: unknown[] }).observedNftEvents.length)).toBeGreaterThanOrEqual(2)
    const duplicate = await action({ action: 'emitDuplicate', payload: { eventId: original.eventId } })
    const older = await action({ action: 'emitOlder', payload: { eventId: original.eventId } })
    await expect.poll(() => page.evaluate(() => (window as unknown as { observedNftEvents: unknown[] }).observedNftEvents.length)).toBeGreaterThanOrEqual(4)
    const frames = await page.evaluate(() => (window as unknown as { observedNftEvents: Array<{ eventId: string; version: number }> }).observedNftEvents)
    expect(frames.filter((frame) => frame.eventId === duplicate.eventId && frame.version === original.version).length).toBeGreaterThanOrEqual(2)
    expect(frames).toContainEqual({ eventId: older.eventId, version: original.version - 1 })
    await expect(item.locator('b')).toHaveText('2.5 ETH')
    await page.reload()
    await expect(item.locator('b')).toHaveText('2.5 ETH')
  })
}

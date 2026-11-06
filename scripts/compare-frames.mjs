import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

// These captures are produced by the E2E tests. They are evidence for
// inspection, not approved baselines or an automatic claim of visual fidelity.
const frames = [
  { id: 'F01', reference: 'docs/figma-inspection/references/F01-desktop-inicio.png', capture: 'tmp/home-desktop.png', reviewObservations: ['Na terceira fileira, o frame exibe oito nomes/preços e uma imagem adicional sem nome/preço; a fixture funcional apresenta nove resultados reais (L07). Revisar o posicionamento e registrar individualmente as diferenças antes de aprovar o frame.'] },
  { id: 'F02', reference: 'docs/figma-inspection/references/F02-desktop-detalhe.png', capture: 'tmp/detail-desktop.png' },
  { id: 'F03', reference: 'docs/figma-inspection/references/F03-desktop-carrinho.png', capture: 'tmp/cart-desktop.png' },
  { id: 'F04', reference: 'docs/figma-inspection/references/F04-desktop-pagamento.png', capture: 'tmp/checkout-reference-desktop.png', reviewObservations: ['A captura usa sessão autenticada, campos preenchidos e botões de desconexão e revisão exigidos pelo fluxo; o frame mostra campos vazios e não desenha essas ações. A extensão vertical e demais diferenças ainda precisam de revisão localizada.'] },
  { id: 'F05', reference: 'docs/figma-inspection/references/F05-desktop-confirmacao.png', capture: 'tmp/order-reference-desktop.png' },
  { id: 'F06', reference: 'docs/figma-inspection/references/F06-desktop-login.png', capture: 'tmp/auth-login-desktop.png' },
  { id: 'F07', reference: 'docs/figma-inspection/references/F07-desktop-cadastro.png', capture: 'tmp/auth-signup-desktop.png' },
  { id: 'F08', reference: 'docs/figma-inspection/references/F08-desktop-perfil.png', capture: 'tmp/profile-desktop.png' },
  { id: 'F09', reference: 'docs/figma-inspection/references/F09-desktop-carteiras.png', capture: 'tmp/wallets-desktop.png' },
  { id: 'F10', reference: 'docs/figma-inspection/references/F10-mobile-inicio.png', capture: 'tmp/home-mobile.png', full: 'tmp/home-mobile-full.png', knownDeviations: ['C04: a arte do quarto card segue a identidade canônica do NFT exibido; no frame mobile a imagem difere do nome repetido na camada. Revisão visual completa pendente.'], reviewObservations: ['As cores do hero seguem o Figma; o teste de contraste aponta valores abaixo de 4,5:1. Conflito de requisitos pendente.'] },
  { id: 'F11', reference: 'docs/figma-inspection/references/F11-mobile-detalhe.png', capture: 'tmp/detail-mobile.png', full: 'tmp/detail-mobile-full.png', knownDeviations: ['C03: primeiro chip de edição mostra 1/1; o frame repete 1/10.'] },
  { id: 'F12', reference: 'docs/figma-inspection/references/F12-mobile-carrinho.png', capture: 'tmp/cart-mobile.png', full: 'tmp/cart-mobile-full.png', knownDeviations: ['C01: subtotal 8.14 e total 8.156 ETH refletem a soma e a taxa; o frame mostra 8.92 e 8.936 ETH.', 'Remoção disponível em todos os cards, conforme a matriz F12; o frame mostra apenas um ícone sobreposto ao controle de quantidade.'], reviewObservations: ['A aparência mais escura das artes vem de uma segunda camada da mesma imagem com blend MULTIPLY: 22:1330, 22:1344, 22:1358 e 16:553. Reprodução implementada; comparação integral dos cards ainda pendente.'] },
  { id: 'F13', reference: 'docs/figma-inspection/references/F13-mobile-pagamento.png', capture: 'tmp/checkout-mobile-reference.png', full: 'tmp/checkout-mobile-reference-full.png', knownDeviations: ['C01: total 8.156 ETH segue a cotação coerente com os itens; o frame mostra 8.936 ETH.', 'L03/L17: ações de revisão e desconexão ficam acessíveis no estado conectado, sem equivalente desenhado no frame.'], reviewObservations: ['Dados das carteiras vêm da fixture e podem diferir dos textos ilustrativos do frame; geometria e demais diferenças permanecem em revisão.'] },
  { id: 'F14', reference: 'docs/figma-inspection/references/F14-mobile-login.png', capture: 'tmp/auth-login-mobile.png', full: 'tmp/auth-login-mobile-full.png' },
  { id: 'F15', reference: 'docs/figma-inspection/references/F15-mobile-cadastro.png', capture: 'tmp/auth-signup-mobile.png', full: 'tmp/auth-signup-mobile-full.png' },
]
const sha256 = (data) => createHash('sha256').update(data).digest('hex')
const out = 'docs/visual-verification'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const comparisons = []
  for (const frame of frames) {
    const reference = await readFile(frame.reference)
    const capture = await readFile(frame.capture)
    const result = await page.evaluate(async ({ ref, app }) => {
      const image = (source) => new Promise((resolve, reject) => {
        const value = new Image()
        value.onload = () => resolve(value)
        value.onerror = () => reject(new Error('Não foi possível ler a imagem'))
        value.src = `data:image/png;base64,${source}`
      })
      const [original, rendered] = await Promise.all([image(ref), image(app)])
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(original.width, rendered.width)
      canvas.height = Math.max(original.height, rendered.height)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(original, 0, 0)
      const expected = ctx.getImageData(0, 0, canvas.width, canvas.height)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(rendered, 0, 0)
      const actual = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const diff = ctx.createImageData(canvas.width, canvas.height)
      let changed = 0
      for (let i = 0; i < expected.data.length; i += 4) {
        const delta = Math.max(Math.abs(expected.data[i] - actual.data[i]), Math.abs(expected.data[i + 1] - actual.data[i + 1]), Math.abs(expected.data[i + 2] - actual.data[i + 2]), Math.abs(expected.data[i + 3] - actual.data[i + 3]))
        if (delta) changed++
        diff.data[i] = delta
        diff.data[i + 3] = 255
      }
      ctx.putImageData(diff, 0, 0)
      return { width: canvas.width, height: canvas.height, referenceDimensions: [original.width, original.height], captureDimensions: [rendered.width, rendered.height], changedPixels: changed, totalPixels: canvas.width * canvas.height, diff: canvas.toDataURL('image/png').split(',')[1] }
    }, { ref: reference.toString('base64'), app: capture.toString('base64') })
    const dir = `${out}/${frame.id}`
    await mkdir(dir, { recursive: true })
    await copyFile(frame.reference, `${dir}/referencia.png`)
    await copyFile(frame.capture, `${dir}/aplicacao.png`)
    if (frame.full) await copyFile(frame.full, `${dir}/aplicacao-completa.png`)
    await writeFile(`${dir}/diferenca.png`, Buffer.from(result.diff, 'base64'))
    const entry = { id: frame.id, width: result.width, height: result.height, referenceDimensions: result.referenceDimensions, captureDimensions: result.captureDimensions, changedPixels: result.changedPixels, totalPixels: result.totalPixels, referenceSha256: sha256(reference), captureSha256: sha256(capture), knownDeviations: frame.knownDeviations ?? [], reviewObservations: frame.reviewObservations ?? [], status: 'review-pending', notes: 'A revisão visual e o registro individual dos desvios de dados e de acessibilidade ainda estão pendentes; imagens de tamanhos diferentes usam canvas ampliado, sem recorte.' }
    comparisons.push(entry)
    console.log(`${frame.id}: ${entry.changedPixels}/${entry.totalPixels} pixels diferentes; revisão pendente`)
  }
  await writeFile(`${out}/comparisons.json`, JSON.stringify({ generatedAt: new Date().toISOString(), method: 'diferença absoluta sem máscara; qualquer variação de canal conta; dados e antialiasing podem diferir', comparisons }, null, 2) + '\n')
} finally {
  await browser.close()
}

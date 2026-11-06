import { containDialogFocus } from '../../shared/dialog-focus.ts'
import { Slider } from '../../components/ui/slider.tsx'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { CatalogParams } from '../../shared/catalog-client.ts'
import { parseEth } from '../../shared/money.ts'

const networks = [{ id: 'ethereum', name: 'Ethereum' }, { id: 'polygon', name: 'Polygon' }, { id: 'solana', name: 'Solana' }] as const
type Props = { initial: CatalogParams; categories: readonly string[]; facets?: { categories: Record<string, number>; networks: Record<string, number> }; deferred?: boolean; apply: (patch: Partial<CatalogParams>) => void; close?: () => void }
function Filters({ initial, categories, facets, deferred = false, apply, close }: Props) {
  const [draft, setDraft] = useState(() => ({ category: initial.category ?? [], network: initial.network ?? [], min: initial.min ?? '', max: initial.max ?? '', sort: initial.sort ?? 'recent' }))
  const [error, setError] = useState('')
  const errorId = useId()
  const selected = deferred ? draft : { ...draft, category: initial.category ?? [], network: initial.network ?? [], sort: initial.sort ?? 'recent' }
  const parsedMin = Number(draft.min || '0.02')
  const parsedMax = Number(draft.max || '12.30')
  const sliderMin = Math.min(0.02, Number.isFinite(parsedMin) ? parsedMin : 0.02)
  const sliderMax = Math.max(12.3, Number.isFinite(parsedMax) ? parsedMax : 12.3, Number.isFinite(parsedMin) ? parsedMin : 0.02)
  const sliderValues = [Math.max(sliderMin, Math.min(sliderMax, Number.isFinite(parsedMin) ? parsedMin : sliderMin)), Math.max(sliderMin, Math.min(sliderMax, Number.isFinite(parsedMax) ? parsedMax : sliderMax))].sort((a, b) => a - b)

  function toggle(field: 'category' | 'network', value: string) {
    const values = selected[field]
    const next = values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]
    if (deferred) setDraft((current) => ({ ...current, [field]: next }))
    else apply({ [field]: next })
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const min = draft.min.trim() ? parseEth(draft.min.trim()) : undefined
      const max = draft.max.trim() ? parseEth(draft.max.trim()) : undefined
      if (min !== undefined && max !== undefined && min > max) throw new Error('Faixa inválida')
      setError('')
      apply({ min: draft.min.trim() || undefined, max: draft.max.trim() || undefined, ...(deferred ? { category: draft.category, network: draft.network, sort: draft.sort } : {}) })
      close?.()
    } catch { setError('Informe uma faixa válida em ETH, com mínimo menor ou igual ao máximo.') }
  }
  return <form className="catalog-filter-form" onSubmit={submit}><h2>Coleções</h2>{categories.map((category) => <label key={category}><input type="checkbox" checked={selected.category.includes(category)} onChange={() => toggle('category', category)} /><span>{category}</span><span>({facets?.categories[category] ?? 0})</span></label>)}<fieldset><legend>Faixa de preço</legend>{!deferred && <><Slider min={sliderMin} max={sliderMax} step={0.01} value={sliderValues} onValueChange={(values) => setDraft((current) => ({ ...current, min: values[0] !== sliderValues[0] ? values[0].toFixed(2) : current.min, max: values[1] !== sliderValues[1] ? values[1].toFixed(2) : current.max }))} /><div className="catalog-price-display">Preço: <input aria-label="Preço mínimo em ETH" aria-invalid={!!error} aria-describedby={error ? errorId : undefined} inputMode="decimal" value={draft.min} onChange={(event) => setDraft({ ...draft, min: event.target.value.replace(',', '.') })} placeholder="0,02" style={{ width: `${Math.max(4, draft.min.length)}ch` }} /> - <input aria-label="Preço máximo em ETH" aria-invalid={!!error} aria-describedby={error ? errorId : undefined} inputMode="decimal" value={draft.max} onChange={(event) => setDraft({ ...draft, max: event.target.value.replace(',', '.') })} placeholder="12,30" style={{ width: `${Math.max(5, draft.max.length)}ch` }} /> ETH</div></>}{deferred && <div className="catalog-price-fields"><label>Mínimo <input aria-label="Preço mínimo em ETH" aria-invalid={!!error} aria-describedby={error ? errorId : undefined} inputMode="decimal" value={draft.min} onChange={(event) => setDraft({ ...draft, min: event.target.value.replace(',', '.') })} placeholder="0,02" /></label><label>Máximo <input aria-label="Preço máximo em ETH" aria-invalid={!!error} aria-describedby={error ? errorId : undefined} inputMode="decimal" value={draft.max} onChange={(event) => setDraft({ ...draft, max: event.target.value.replace(',', '.') })} placeholder="12,30" /></label></div>}{error && <p id={errorId} role="alert">{error}</p>}{!deferred && <button type="submit">Aplicar</button>}</fieldset><fieldset><legend>Rede</legend>{networks.map((network) => <label key={network.id}><input type="checkbox" checked={selected.network.includes(network.id)} onChange={() => toggle('network', network.id)} /><span>{network.name}</span><span>({facets?.networks[network.id] ?? 0})</span></label>)}</fieldset>{deferred && <><label>Ordenar por: <select value={draft.sort} onChange={(event) => setDraft({ ...draft, sort: event.target.value as NonNullable<CatalogParams['sort']> })}><option value="recent">Listados recentemente</option><option value="name-asc">Nome A–Z</option><option value="name-desc">Nome Z–A</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option></select></label><div className="catalog-filter-actions"><button type="submit">Aplicar filtros</button><button type="button" onClick={close}>Fechar</button></div></>}</form>
}
export function DesktopFilters(props: Props & { featured?: boolean }) {
  return <aside className="home-filters"><div className="home-filter-panel"><Filters key={`${props.initial.min ?? ''}:${props.initial.max ?? ''}`} {...props} /></div>{props.featured && <section className="home-featured" aria-label="NFT em destaque"><h2>NFT EM DESTAQUE</h2><p>OFERTA LIMITADA</p><img src="/assets/nft/2986a7cb16d09de8970824d2dd58bf0bb021702c.webp" alt="" /></section>}</aside>
}
export function FilterDialog(props: Props & { close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; if (dialog && !dialog.open) dialog.showModal(); return () => { if (dialog?.open) dialog.close() } }, [])
  function dismiss() { ref.current?.close(); props.close() }
  return <dialog className="catalog-filter-dialog" ref={ref} aria-label="Filtros" onCancel={(event) => { event.preventDefault(); dismiss() }} onKeyDown={containDialogFocus}><Filters {...props} deferred close={dismiss} /></dialog>
}

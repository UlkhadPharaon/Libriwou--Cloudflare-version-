export interface LineItemData {
  description: string;
  quantity?: number;
  unitPrice?: number;
  amountExclTax?: number;
}

function lineAmount(l: LineItemData): number {
  const amt = Number(l.amountExclTax);
  if (Number.isFinite(amt) && amt > 0) return amt;
  return (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
}

/** Read-only article-lines list shared by Expenses / Scan / Hub saved views. */
export function LineItemsView({ items, currency = 'FCFA' }: { items?: LineItemData[] | null; currency?: string }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const total = items.reduce((s, l) => s + lineAmount(l), 0);
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <div className="px-3 py-2 bg-white/5 text-xs font-semibold text-gold-100 flex items-center justify-between">
        <span>Détail des articles ({items.length})</span>
        <span className="font-mono">Σ {Math.round(total).toLocaleString('fr-FR')} {currency}</span>
      </div>
      {items.map((l, i) => (
        <div key={i} className="px-3 py-1.5 border-t border-white/5 text-xs flex items-center justify-between gap-2">
          <span className="text-gold-100 truncate">{l.description || 'Article sans nom'}</span>
          <span className="text-zinc-400 shrink-0">×{l.quantity ?? 1}</span>
          <span className="text-gold-100 font-mono shrink-0">
            {Math.round(lineAmount(l)).toLocaleString('fr-FR')} {currency}
          </span>
        </div>
      ))}
    </div>
  );
}

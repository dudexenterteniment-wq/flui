// Flui — utilidades de interface: formatação, ícones, gráficos em SVG (sem dependências)
import { nomeMes } from './calc.js?v=139';

const FMT = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl = (v) => FMT.format(Number(v) || 0);
export const brl0 = (v) => FMT.format(Math.round(Number(v) || 0)).replace(/,00$/, '');
export const pct = (v) => `${Math.round((v || 0) * 100)}%`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function parseValor(s) {
  if (typeof s === 'number') return s;
  let t = String(s || '').replace(/[R$\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
export const valorInput = (v) => (v || v === 0) && v !== '' ? String(Number(v).toFixed(2)).replace('.', ',') : '';

export const ICON = {
  inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  lanc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor"/></svg>',
  cartao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6 15h4"/></svg>',
  plano: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M8 2.5v4M16 2.5v4M3.5 10h17M8 14h3M8 17h6"/></svg>',
  relat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  metas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  config: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.5"/><circle cx="10" cy="17" r="2.5"/></svg>',
  mais: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>',
  cats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"/></svg>',
};

// mascote provisório (a águia definitiva entra depois)
export const MASCOTE = '<svg viewBox="0 0 40 40" fill="none"><path d="M8 26c0-9 6-16 14-16 5 0 9 3 10 7l-6 2 6 3c-2 7-8 10-14 10-6 0-10-2-10-6z" fill="#fff"/><circle cx="24" cy="18" r="2.4" fill="#3C3C3C"/><path d="M32 17l6 2-6 3z" fill="#FFC800"/><path d="M10 28c4-1 8-1 12 2" stroke="#B5D6FF" stroke-width="2.4" stroke-linecap="round"/></svg>';

// ---------- rosca (donut) ----------
export function rosca(dados, total) {
  const R = 80, r = 50, cx = 100, cy = 100;
  if (!total) return `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="${(R + r) / 2}" fill="none" stroke="#E5E5E5" stroke-width="${R - r}"/></svg>`;
  let a0 = -Math.PI / 2; const parts = [];
  for (const d of dados) {
    const frac = d.valor / total; if (frac <= 0) continue;
    if (frac >= 0.9999) { parts.push(`<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${d.cor}" stroke-width="${R - r}"><title>${esc(d.nome)}: ${brl(d.valor)}</title></circle>`); break; }
    const a1 = a0 + frac * Math.PI * 2; const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad, ang) => `${cx + rad * Math.cos(ang)} ${cy + rad * Math.sin(ang)}`;
    parts.push(`<path d="M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z" fill="${d.cor}" stroke="#fff" stroke-width="2"><title>${esc(d.nome)}: ${brl(d.valor)}</title></path>`);
    a0 = a1;
  }
  return `<svg viewBox="0 0 200 200" role="img" aria-label="Gráfico de rosca">${parts.join('')}
    <text x="100" y="96" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="12" fill="#777">TOTAL</text>
    <text x="100" y="116" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="17" fill="#3C3C3C">${brl0(total)}</text></svg>`;
}

// ---------- barras agrupadas por mês ----------
export function barras(meses, series) {
  // series: [{nome, cor, valores:[]}]
  const H = 180, padL = 8, padB = 26, top = 10;
  const gw = Math.max(44, Math.min(90, 640 / Math.max(1, meses.length)));
  const W = padL * 2 + gw * meses.length;
  const max = Math.max(1, ...series.flatMap((s) => s.valores));
  const bw = Math.min(18, (gw - 12) / series.length);
  let out = '';
  meses.forEach((m, i) => {
    const x0 = padL + i * gw + (gw - bw * series.length - 4 * (series.length - 1)) / 2;
    series.forEach((s, j) => {
      const v = s.valores[i] || 0; const h = Math.round((v / max) * (H - padB - top));
      const x = x0 + j * (bw + 4);
      out += `<rect x="${x}" y="${H - padB - h}" width="${bw}" height="${Math.max(h, v > 0 ? 3 : 0)}" rx="5" fill="${s.cor}"><title>${s.nome} ${nomeMes(m)}: ${brl(v)}</title></rect>`;
    });
    out += `<text x="${padL + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="12" fill="#777">${nomeMes(m)}</text>`;
  });
  out += `<line x1="0" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="#E5E5E5" stroke-width="2"/>`;
  return `<div class="barras"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Gráfico de barras">${out}</svg></div>
    <div class="chips" style="margin-top:8px">${series.map((s) => `<span class="mini"><span class="ponto" style="background:${s.cor}"></span>${s.nome}</span>`).join('')}</div>`;
}

export function toast(msg, festa = false) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div'); t.className = 'toast' + (festa ? ' festa' : ''); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}

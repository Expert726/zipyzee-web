'use client';
// QR and barcode, Create (the app's custom/qr/QrCreate + LinksEditor, design/FlowQrScanner.dc.html step 2): "Code for"
// Link / Links / Text / Wi-Fi / Contact / Phone with their fields (src/tools/qr.ts), Links rows with "Paste all"
// (src/tools/qrLinks.ts), the live preview, and Design: colour or gradient, background, a logo in the middle;
// too-long text and colours that wouldn't scan are refused (src/tools/qrDesign.ts). The design is kept for next time.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, Eye, EyeOff, Globe, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { drawQr, qrMatrix, qrSvg } from '@/lib/qrDraw';
import { useStored } from '@/lib/useStored';
import { buildCode, CREATE_FIELDS, CREATE_KINDS, type CreateKind } from '@/tools/qr';
import { QR_BACKGROUNDS, QR_INKS } from '@/tools/qrColors';
import { scannable } from '@/tools/qrDesign';
import { MAX_LINKS, parsePasted, platformName, platformOf, safeUrl, type LinkRow } from '@/tools/qrLinks';
import { Button } from '../../../ui/Button';
import { Switch } from '../../../custom/makedoc/parts';

export const QR_PNG_SIZE = 1024;

export function QrCreateView({ onSave }: { onSave: (v: { kind: CreateKind; png: Blob; svg: string }) => void }) {
  const t = useT();
  const [kind, setKind] = useState<CreateKind>('link');
  const [values, setValues] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<LinkRow[]>([{ label: '', url: '' }]);
  const [shown, setShown] = useState(false);
  const [logo, setLogo] = useState<{ img: ImageBitmap; png: string } | null>(null);
  const [pasteEmpty, setPasteEmpty] = useState(false);
  const [design, setDesign] = useStored('qrDesign', { ink: '#111111', gradient: false, background: '#FFFFFF' });
  const preview = useRef<HTMLCanvasElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const code = useMemo(() => buildCode(kind, { ...values, links: JSON.stringify(rows) }), [kind, values, rows]);
  const ink = QR_INKS.find((i) => i.value === design.ink) ?? QR_INKS[0];
  const background = QR_BACKGROUNDS.find((b) => b.value === design.background)?.value ?? QR_BACKGROUNDS[0].value;
  const look = useMemo(() => ({ ink: ink.value, to: design.gradient ? ink.to : undefined, background, logo: logo?.img ?? null }), [ink, design.gradient, background, logo]);
  const readable = scannable(design.gradient ? [ink.value, ink.to] : [ink.value], background);
  // too much for one code (worked out from the text, not while drawing)
  const tooLong = useMemo(() => !!code && !qrMatrix(code, !!logo), [code, logo]);

  // the live preview
  useEffect(() => {
    const c = preview.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    const q = code ? drawQr(code, look, 480) : null;
    if (q) {
      c.width = c.height = 480;
      g.drawImage(q, 0, 0);
    }
  }, [code, look]);

  const paste = async () => {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      // no permission: nothing to paste
    }
    const page = parsePasted(text);
    if (!page.links.length) return setPasteEmpty(true);
    setPasteEmpty(false);
    setRows(page.links.slice(0, MAX_LINKS));
    setValues((v) => ({ ...v, title: page.title || v.title || '', note: page.note ?? v.note ?? '' }));
  };

  const save = async () => {
    const big = drawQr(code, look, QR_PNG_SIZE);
    const svg = qrSvg(code, look, logo?.png);
    if (!big || !svg) return;
    const png = await new Promise<Blob | null>((r) => big.toBlob(r, 'image/png'));
    if (png) onSave({ kind, png, svg });
  };

  const ready = !!code && !tooLong && readable;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
      <section className="card p-5 flex flex-col gap-5">
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t('Code for')}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {CREATE_KINDS.map((k) => (
              <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} onClick={() => setKind(k.value)} className={`px-4 min-h-10 rounded-full text-sm font-medium border ${kind === k.value ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-line-strong hover:bg-fill'}`}>
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>
        {kind === 'links' && <p className="text-[13px] text-secondary -mt-2">{t('One code for all your links: anyone who scans it sees them as buttons, to open or copy.')}</p>}

        {CREATE_FIELDS[kind].map((f) => (
          <label key={`${kind}-${f.key}`} className="flex flex-col gap-1.5 text-[13px] font-semibold">
            {f.label}
            {f.multiline ? (
              <textarea value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} rows={4} dir="auto" className="rounded-tile bg-surface border border-line-strong px-3 py-2 text-[15px] font-normal" />
            ) : (
              <span className="relative">
                <input
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  type={f.secure && !shown ? 'password' : f.keyboard === 'email-address' ? 'email' : f.keyboard === 'phone-pad' ? 'tel' : f.keyboard === 'url' ? 'url' : 'text'}
                  inputMode={f.keyboard === 'phone-pad' ? 'tel' : f.keyboard === 'url' ? 'url' : f.keyboard === 'email-address' ? 'email' : undefined}
                  dir={f.keyboard || f.secure ? 'ltr' : 'auto'}
                  autoComplete="off"
                  className={`w-full min-h-12 rounded-tile bg-surface border border-line-strong px-3 text-[15px] font-normal ${f.secure ? 'pe-12' : ''}`}
                />
                {f.secure && (
                  <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? t('Hide password') : t('Show password')} className="absolute end-1 top-1/2 -translate-y-1/2 size-10 rounded-full grid place-items-center text-secondary hover:bg-fill">
                    {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                )}
              </span>
            )}
          </label>
        ))}

        {kind === 'links' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center">
              <p className="flex-1 text-[13px] font-semibold">{t('Links ({count})', { count: rows.length })}</p>
              <Button variant="ghost" onClick={() => void paste()}>
                <ClipboardPaste size={16} aria-hidden="true" className="inline me-1.5" />
                {t('Paste all')}
              </Button>
            </div>
            {rows.map((r, i) => {
              const url = safeUrl(r.url);
              return (
                <div key={i} className="rounded-row bg-fill p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Globe size={17} className="text-primary shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-[14px] font-semibold truncate">{r.label.trim() || (url ? platformName(platformOf(url)) : t('Link {n}', { n: i + 1 }))}</span>
                    <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={t('Remove link')} className="size-8 rounded-full grid place-items-center hover:bg-fill-strong">
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <input value={r.url} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://" inputMode="url" dir="ltr" aria-label={t('Link')} className="min-h-11 rounded-tile bg-surface border border-line-strong px-3 text-[14px]" />
                  {r.url.trim() && !url && <p className="text-[12px] text-warning">{t('This doesn\'t look like a web link.')}</p>}
                  <input value={r.label} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder={t('Label (optional)')} dir="auto" aria-label={t('Label (optional)')} className="min-h-11 rounded-tile bg-surface border border-line-strong px-3 text-[14px]" />
                </div>
              );
            })}
            {rows.length < MAX_LINKS && (
              <Button variant="secondary" onClick={() => setRows([...rows, { label: '', url: '' }])}>
                <Plus size={16} aria-hidden="true" className="inline me-1.5" />
                {t('Add link')}
              </Button>
            )}
            {pasteEmpty && <p className="text-[13px] text-warning">{t('No links found in what you copied. Copy lines like "Instagram: https://..." and try again.')}</p>}
          </div>
        )}
      </section>

      <aside className="card p-5 flex flex-col gap-4 lg:sticky lg:top-20">
        <div className="grid place-items-center rounded-tile p-3" style={{ background }}>
          <canvas ref={preview} width={480} height={480} className="w-56 h-56" aria-label={t('QR code preview')} />
        </div>
        {!code && <p className="text-[13px] text-secondary text-center -mt-2">{t('Fill in the fields to see your code.')}</p>}
        {tooLong && <p className="text-[13px] text-warning">{t('That\'s too much for one QR code. Make the text shorter.')}</p>}
        {!readable && <p className="text-[13px] text-warning">{t('Too little contrast to scan. Pick a darker colour or a lighter background.')}</p>}

        <p className="text-[15px] font-semibold">{t('Design')}</p>
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t('Colour')}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {QR_INKS.map((i) => (
              <button key={i.value} type="button" role="radio" aria-checked={ink.value === i.value} aria-label={t(i.label)} title={t(i.label)} onClick={() => setDesign({ ...design, ink: i.value })} className={`size-9 rounded-full border ${ink.value === i.value ? 'ring-3 ring-primary ring-offset-2 ring-offset-surface border-transparent' : 'border-line-strong'}`} style={{ background: design.gradient ? `linear-gradient(135deg, ${i.value}, ${i.to})` : i.value }} />
            ))}
          </div>
        </fieldset>
        <Switch label={t('Gradient')} sub={t('Two colours that blend across the code')} value={design.gradient} onChange={(v) => setDesign({ ...design, gradient: v })} />
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t('Background')}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {QR_BACKGROUNDS.map((b) => (
              <button key={b.value} type="button" role="radio" aria-checked={background === b.value} aria-label={t(b.label)} title={t(b.label)} onClick={() => setDesign({ ...design, background: b.value })} className={`size-9 rounded-full border border-line-strong ${background === b.value ? 'ring-3 ring-primary ring-offset-2 ring-offset-surface' : ''}`} style={{ background: b.value }} />
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-2">
          <input
            ref={logoInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const img = await createImageBitmap(f);
                const c = document.createElement('canvas');
                const k = Math.min(1, 256 / Math.max(img.width, img.height));
                c.width = Math.round(img.width * k);
                c.height = Math.round(img.height * k);
                c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
                setLogo({ img, png: c.toDataURL('image/png') });
              } catch {
                // not an image the browser can open: nothing changes
              }
            }}
          />
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- the chosen logo
            <img src={logo.png} alt={t('Logo')} className="size-10 rounded-md object-contain bg-white border border-line" />
          )}
          <Button variant="secondary" onClick={() => logoInput.current?.click()} className="flex-1">
            <ImagePlus size={16} aria-hidden="true" className="inline me-1.5" />
            {logo ? t('Change logo') : t('Add a logo')}
          </Button>
          {logo && (
            <button type="button" onClick={() => setLogo(null)} aria-label={t('Remove')} title={t('Remove')} className="size-10 rounded-full grid place-items-center hover:bg-fill">
              <Trash2 size={17} aria-hidden="true" />
            </button>
          )}
        </div>
        <Button arrow disabled={!ready} onClick={() => void save()} className="w-full">
          {t('Save QR code')}
        </Button>
      </aside>
    </div>
  );
}

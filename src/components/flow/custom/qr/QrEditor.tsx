'use client';
// QR and barcode (the app's custom/qr/QrStep: Scan or Create, its ModePill): Scan reads codes with the camera, a
// photo or a pasted screenshot; Create makes a code and saves it (handlers/qrCreate.ts: PNG + SVG).
import { useState } from 'react';
import { useT } from '@/i18n/client';
import { Choice } from '../../../custom/makedoc/parts';
import type { CustomSetupProps } from '../index';
import { QrCreateView } from './QrCreateView';
import { QrScanView } from './QrScanView';

export function QrEditor({ onStart }: CustomSetupProps) {
  const t = useT();
  const [mode, setMode] = useState<'scan' | 'create'>('scan');
  return (
    <div className="flex flex-col items-center gap-4">
      <Choice value={mode} options={[['scan', t('Scan')], ['create', t('Create')]]} onChange={setMode} />
      <div className="w-full">{mode === 'scan' ? <QrScanView /> : <QrCreateView onSave={(v) => onStart(v)} />}</div>
    </div>
  );
}

'use client';
// Signature maker, step 2 (the app's custom/image/SignatureMakerStep): the signature pad from Sign PDF (Draw / Type /
// Photo), in the page. Its trimmed, see-through PNG goes to handlers/signatureMaker.ts; "Save for next time" also keeps
// it for Sign PDF and Annotate in this browser.
import { useT } from '@/i18n/client';
import { useSignatures } from '@/lib/signatures';
import { newId } from '@/tools/annotate/model';
import { SignaturePad } from './annotate/SignaturePad';
import type { CustomSetupProps } from './index';

export function SignatureMakerEditor({ tool, onStart }: CustomSetupProps) {
  const t = useT();
  const { add } = useSignatures();
  return (
    <SignaturePad
      inline
      doneLabel={t(tool.verb)}
      onDone={(s) => {
        if (s.save) add({ id: newId(), png: s.png, w: s.w, h: s.h });
        onStart({ png: s.png });
      }}
    />
  );
}

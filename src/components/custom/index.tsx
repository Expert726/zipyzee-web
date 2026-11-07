'use client';
// Tools with their own screen instead of the file flow (the app's CUSTOM_SETUPS). Add the id to
// src/tools/handlers/ids.ts too.
import { Suspense } from 'react';
import { AgeCalculator } from './AgeCalculator';
import { Calculator } from './Calculator';
import { TextEditor } from './text/TextEditor';
import { MakeDoc } from './makedoc/MakeDoc';

const CUSTOM_TOOLS: Record<string, () => React.ReactElement> = {
  calculator: Calculator,
  'age-calculator': AgeCalculator,
  'text-editor': TextEditor,
  'make-doc': MakeDoc,
};

export function CustomTool({ id }: { id: string }) {
  const Screen = CUSTOM_TOOLS[id];
  // screens that keep state in the URL (useSearchParams) need a boundary on a prerendered page
  return (
    <Suspense fallback={<div className="card min-h-64" aria-busy="true" />}>
      <Screen />
    </Suspense>
  );
}

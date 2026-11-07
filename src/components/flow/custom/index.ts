// Tools whose step 2 is their own editor (the app's src/flow/custom CUSTOM_SETUPS). The editor gets the picked files
// and calls onStart with its values; the handler reads them as options.
import type { OptionValues, Tool, ToolResult } from '@/tools/types';
import { OrganizeEditor } from './OrganizeEditor';
import { RemoveWatermarkEditor } from './RemoveWatermarkEditor';
import { AnnotateEditor } from './annotate/AnnotateEditor';
import { FormsEditor } from './FormsEditor';
import { CompareResult } from './CompareResult';
import { RedactEditor } from './RedactEditor';
import { BgEditor } from './BgEditor';
import { CropImageEditor } from './CropImageEditor';
import { PassportEditor } from './PassportEditor';
import { BlurEditor } from './BlurEditor';
import { DrawEditor } from './DrawEditor';
import { CollageEditor } from './CollageEditor';
import { SignatureMakerEditor } from './SignatureMakerEditor';
import { EraserEditor } from './EraserEditor';

/** onReplace opens the file picker (it adds to the list on a many-files tool); onFiles changes the list (Collage). */
export type CustomSetupProps = { tool: Tool; files: File[]; onStart: (values: OptionValues) => void; onReplace: () => void; onFiles?: (files: File[]) => void };

export const CUSTOM_SETUPS: Record<string, (p: CustomSetupProps) => React.ReactElement> = {
  'organize-pdf': OrganizeEditor,
  'remove-watermark': RemoveWatermarkEditor,
  'annotate-pdf': AnnotateEditor,
  'sign-pdf': AnnotateEditor,
  'pdf-forms': FormsEditor,
  'redact-pdf': RedactEditor,
  'remove-bg': BgEditor,
  'change-bg': BgEditor,
  'crop-image': CropImageEditor,
  'passport-photo': PassportEditor,
  'blur-image': BlurEditor,
  'draw-image': DrawEditor,
  collage: CollageEditor,
  'signature-maker': SignatureMakerEditor,
  'object-eraser': EraserEditor,
};

/** Tools whose step 4 is their own screen (the app's CUSTOM_RESULTS). */
export type CustomResultProps = { tool: Tool; files: File[]; result: ToolResult; onReset: () => void };
export const CUSTOM_RESULTS: Record<string, (p: CustomResultProps) => React.ReactElement> = {
  'compare-pdf': CompareResult,
};

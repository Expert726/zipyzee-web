// PDF forms (design/FlowPdfForms.dc.html): read, fill and flatten AcroForm fields with pdf-lib. Pure; unit-tested.
import {
  PDFCheckBox,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFString,
  PDFHexString,
  PDFTextField,
  type PDFDocument,
  type PDFField,
  type PDFFont,
  type PDFRef,
} from 'pdf-lib';

export type FormFieldType = 'text' | 'checkbox' | 'radio' | 'dropdown';

export type FormWidget = {
  /** 0-based page index. */
  page: number;
  /** [x, y, width, height] in PDF user space. */
  rect: [number, number, number, number];
  /** Radio buttons: the choice this widget stands for. */
  option?: string;
};

export type FormField = {
  name: string;
  /** Tooltip (/TU) or a readable version of the name. */
  label: string;
  type: FormFieldType;
  /** text / radio / dropdown: the text or choice ('' = empty); checkbox: checked. */
  value: string | boolean;
  options?: string[];
  multiline?: boolean;
  /** Probably a date (name or label says so): the editor shows a date hint. */
  date?: boolean;
  widgets: FormWidget[];
};

export type FormValues = Record<string, string | boolean>;

/** 'full_name' -> 'Full name', 'dateOfBirth' -> 'Date of birth', 'form1[0].page1[0].city[0]' -> 'City'. */
export function readableName(name: string): string {
  const last = name.split('.').pop() ?? name;
  const words = last
    .replace(/\[\d+\]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : name;
}

function tooltip(field: PDFField): string | undefined {
  const tu = field.acroField.dict.get(PDFName.of('TU'));
  if (tu instanceof PDFString || tu instanceof PDFHexString) return tu.decodeText().trim() || undefined;
  return undefined;
}

/** Page index for each widget: its /P entry, or the page whose /Annots holds it. */
function widgetPages(doc: PDFDocument, field: PDFField): number[] {
  const pages = doc.getPages();
  return field.acroField.getWidgets().map((w) => {
    const p = w.P();
    if (p) {
      const i = pages.findIndex((pg) => pg.ref === p);
      if (i >= 0) return i;
    }
    const ref = doc.context.getObjectRef(w.dict) as PDFRef | undefined;
    if (!ref) return 0;
    const i = pages.findIndex((pg) => pg.node.Annots()?.asArray().some((a) => a === ref));
    return i >= 0 ? i : 0;
  });
}

export function readFields(doc: PDFDocument): FormField[] {
  const out: FormField[] = [];
  for (const field of doc.getForm().getFields()) {
    const name = field.getName();
    const label = tooltip(field) ?? readableName(name);
    const pages = widgetPages(doc, field);
    const widgets: FormWidget[] = field.acroField.getWidgets().map((w, i) => {
      const r = w.getRectangle();
      return { page: pages[i], rect: [r.x, r.y, r.width, r.height] };
    });
    const date = /date|\bdob\b|birth/i.test(`${name} ${label}`);

    if (field instanceof PDFTextField) {
      out.push({ name, label, type: 'text', value: field.getText() ?? '', multiline: field.isMultiline(), date, widgets });
    } else if (field instanceof PDFCheckBox) {
      out.push({ name, label, type: 'checkbox', value: field.isChecked(), widgets });
    } else if (field instanceof PDFRadioGroup) {
      // one widget per choice, in the same order as the on-values
      const onValues = field.acroField.getOnValues().map((v) => v.decodeText());
      const options = field.getOptions();
      widgets.forEach((w, i) => {
        w.option = options[i] ?? onValues[i];
      });
      out.push({ name, label, type: 'radio', value: field.getSelected() ?? '', options, widgets });
    } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
      out.push({ name, label, type: 'dropdown', value: field.getSelected()[0] ?? '', options: field.getOptions(), widgets });
    }
    // signatures and push buttons are not filled here
  }
  return out;
}

/** Characters in `values` that `font` can't draw (e.g. Urdu with a Latin font). */
export function unsupportedChars(values: FormValues, font: PDFFont): string[] {
  const supported = new Set(font.getCharacterSet());
  const missing = new Set<string>();
  for (const v of Object.values(values)) {
    if (typeof v !== 'string') continue;
    for (const ch of v) {
      const cp = ch.codePointAt(0)!;
      if (cp > 31 && !supported.has(cp)) missing.add(ch);
    }
  }
  return [...missing];
}

/**
 * Writes values into the form. With `font`, field appearances are redrawn in it so the values show in every
 * viewer; with `flatten`, fields become plain page content. Returns the number of fields written.
 */
export function fillFields(doc: PDFDocument, values: FormValues, opts: { font?: PDFFont; flatten?: boolean } = {}): number {
  const form = doc.getForm();
  let filled = 0;
  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe(name);
    if (!field) continue;
    if (field instanceof PDFTextField && typeof value === 'string') {
      const max = field.getMaxLength();
      field.setText(value === '' ? undefined : max != null ? value.slice(0, max) : value);
    } else if (field instanceof PDFCheckBox && typeof value === 'boolean') {
      if (value) field.check();
      else field.uncheck();
    } else if (field instanceof PDFRadioGroup && typeof value === 'string') {
      if (value) field.select(value);
      else field.clear();
    } else if ((field instanceof PDFDropdown || field instanceof PDFOptionList) && typeof value === 'string') {
      if (value) field.select(value);
      else field.clear();
    } else {
      continue;
    }
    filled++;
  }
  if (opts.font) form.updateFieldAppearances(opts.font);
  if (opts.flatten) form.flatten({ updateFieldAppearances: !opts.font });
  return filled;
}

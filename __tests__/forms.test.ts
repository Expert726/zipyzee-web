// The app's __tests__/forms.test.ts, with Helvetica (the web's form font) instead of the app's Plus Jakarta.
/// <reference types="node" /> // reads the bundled TTF (Jest runs in Node)
import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib';
import { fillFields, readableName, readFields, unsupportedChars } from '@/tools/forms';

/** A 2-page form like the board's admission form. */
async function makeForm() {
  const doc = await PDFDocument.create();
  const p1 = doc.addPage([600, 800]);
  const p2 = doc.addPage([600, 800]);
  const form = doc.getForm();

  const name = form.createTextField('full_name');
  name.addToPage(p1, { x: 50, y: 700, width: 300, height: 24 });
  const date = form.createTextField('form1[0].Date[0]');
  date.addToPage(p1, { x: 50, y: 650, width: 150, height: 24 });
  const id = form.createTextField('sid');
  id.acroField.dict.set(PDFName.of('TU'), PDFString.of('Student ID'));
  id.addToPage(p1, { x: 50, y: 600, width: 150, height: 24 });
  const notes = form.createTextField('notes');
  notes.enableMultiline();
  notes.addToPage(p2, { x: 50, y: 400, width: 400, height: 100 });

  form.createCheckBox('agree').addToPage(p1, { x: 50, y: 550, width: 14, height: 14 });

  const gender = form.createRadioGroup('gender');
  gender.addOptionToPage('Male', p2, { x: 50, y: 700, width: 14, height: 14 });
  gender.addOptionToPage('Female', p2, { x: 120, y: 700, width: 14, height: 14 });

  const city = form.createDropdown('city');
  city.addOptions(['Lahore', 'Karachi', 'Islamabad']);
  city.addToPage(p2, { x: 50, y: 600, width: 150, height: 24 });

  return PDFDocument.load(await doc.save());
}


describe('readableName', () => {
  it('turns field names into labels', () => {
    expect(readableName('full_name')).toBe('Full name');
    expect(readableName('dateOfBirth')).toBe('Date of birth');
    expect(readableName('form1[0].page1[0].city[0]')).toBe('City');
  });
});

describe('readFields', () => {
  it('lists fields with type, label, page and rect', async () => {
    const fields = readFields(await makeForm());
    const by = Object.fromEntries(fields.map((f) => [f.name, f]));

    expect(by.full_name).toMatchObject({ type: 'text', label: 'Full name', value: '', widgets: [{ page: 0 }] });
    // pdf-lib grows a new widget by half its border width on each side
    by.full_name.widgets[0].rect.forEach((v, i) => expect(Math.abs(v - [50, 700, 300, 24][i])).toBeLessThanOrEqual(1));
    expect(by['form1[0].Date[0]']).toMatchObject({ label: 'Date', date: true });
    expect(by.sid.label).toBe('Student ID');
    expect(by.notes).toMatchObject({ multiline: true, widgets: [{ page: 1 }] });
    expect(by.agree).toMatchObject({ type: 'checkbox', value: false, widgets: [{ page: 0 }] });
    expect(by.gender).toMatchObject({ type: 'radio', options: ['Male', 'Female'], widgets: [{ page: 1, option: 'Male' }, { page: 1, option: 'Female' }] });
    expect(by.city).toMatchObject({ type: 'dropdown', options: ['Lahore', 'Karachi', 'Islamabad'], value: '' });
  });
});

describe('fillFields', () => {
  it('fills every kind of field; values survive save and reload', async () => {
    const doc = await makeForm();
    const f = await doc.embedFont(StandardFonts.Helvetica); // the web's form font
    const n = fillFields(doc, { full_name: 'Zain Ahmed', agree: true, gender: 'Female', city: 'Karachi', missing: 'x' }, { font: f });
    expect(n).toBe(4);

    const again = readFields(await PDFDocument.load(await doc.save()));
    const by = Object.fromEntries(again.map((x) => [x.name, x.value]));
    expect(by).toMatchObject({ full_name: 'Zain Ahmed', agree: true, gender: 'Female', city: 'Karachi' });
  });

  it('flattening leaves no fields to edit', async () => {
    const doc = await makeForm();
    const f = await doc.embedFont(StandardFonts.Helvetica); // the web's form font
    fillFields(doc, { full_name: 'Zain Ahmed', agree: true }, { font: f, flatten: true });
    const again = await PDFDocument.load(await doc.save());
    expect(again.getForm().getFields()).toHaveLength(0);
  });

  it('finds characters the font cannot draw', async () => {
    const doc = await PDFDocument.create();
    const f = await doc.embedFont(StandardFonts.Helvetica);
    expect(unsupportedChars({ a: 'Zain Ahmed', b: true }, f)).toEqual([]);
    expect(unsupportedChars({ a: 'زین' }, f).length).toBeGreaterThan(0);
  });
});

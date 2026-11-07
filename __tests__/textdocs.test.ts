import { describe, expect, it } from 'vitest';
import { sanitizeHtml, textPageHtml } from '@/textdocs/page';
import { htmlToText, titleOf, wordCount } from '@/textdocs/edit';
import { normalizeLink } from '@/components/custom/text/Editor';

describe('Text editor', () => {
  it('cleans pasted or saved HTML', () => {
    const dirty = '<p onclick="x()">Hi<script>alert(1)</script></p><img src="https://evil/x.png"><img src="data:image/png;base64,AA"><a href="javascript:alert(1)">a</a><input type="text"><input type="checkbox" checked name="n">';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toMatch(/onclick|script|evil|javascript|type="text"|name=/);
    expect(clean).toContain('data:image/png');
    expect(clean).toContain('type="checkbox" checked');
  });

  it('reads the text, words and title', () => {
    const text = htmlToText('<h1>Notes</h1><p>Two&nbsp;words</p><ul><li>three</li></ul>');
    expect(text).toBe('Notes\nTwo words\nthree');
    expect(wordCount(text)).toBe(4);
    expect(titleOf({ title: '', text }, 'Untitled')).toBe('Notes');
  });

  it('prints the title and the cleaned body on A4', () => {
    const page = textPageHtml({ title: 'My <notes>', html: '<p>x</p><script>bad()</script>', size: 'l' });
    expect(page).toContain('size:A4');
    expect(page).toContain('My &lt;notes&gt;');
    expect(page).toContain('font-size:14pt');
    expect(page).not.toContain('bad()');
  });

  it('accepts web, mail and phone links only', () => {
    expect(normalizeLink('example.com/a')).toBe('https://example.com/a');
    expect(normalizeLink('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(normalizeLink('javascript:alert(1)')).toBeNull();
    expect(normalizeLink('hello')).toBeNull();
  });

});

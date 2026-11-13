import { describe, expect, it } from 'vitest';
import { cleanCode, deviceName, itemId, onlyLink, parseWire, pieceCount, roomCode, safeName, showCode } from '../src/zeeshare/protocol';

describe('ZeeShare protocol', () => {
  it('makes and reads 6-digit codes', () => {
    expect(roomCode(() => 0)).toBe('100000');
    expect(roomCode(() => 0.999999)).toBe('999999');
    expect(cleanCode(' 482 913 ')).toBe('482913');
    expect(cleanCode('48291')).toBeNull();
    expect(cleanCode('082913')).toBeNull();
    expect(showCode('482913')).toBe('482 913');
  });

  it('names devices', () => {
    expect(deviceName('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36')).toBe('Chrome on Android');
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iPhone');
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0')).toBe('Edge on Windows');
    expect(deviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0')).toBe('Firefox on Mac');
  });

  it('checks what the other device sends', () => {
    expect(parseWire('{"t":"text","id":"a1","text":"hi","at":1}')).toEqual({ t: 'text', id: 'a1', text: 'hi', at: 1 });
    expect(parseWire('{"t":"file","id":"a1","name":"../../x.png","mime":"image/png","size":10,"at":1}')).toMatchObject({ name: '_.._x.png' });
    expect(parseWire('{"t":"file","id":"a1","name":"x","mime":"a","size":-1,"at":1}')).toBeNull();
    expect(parseWire('{"t":"text","id":"a1","text":5,"at":1}')).toBeNull();
    expect(parseWire('{"t":"nope"}')).toBeNull();
    expect(parseWire('not json')).toBeNull();
    expect(parseWire('{"t":"bye"}')).toEqual({ t: 'bye' });
  });

  it('keeps file names safe', () => {
    expect(safeName('a/b\\c:d.txt')).toBe('a_b_c_d.txt');
    expect(safeName('...hidden')).toBe('hidden');
    expect(safeName('\u0000')).toBe('file');
  });

  it('counts pieces and makes ids', () => {
    expect(pieceCount(0)).toBe(1);
    expect(pieceCount(65536)).toBe(1);
    expect(pieceCount(65537)).toBe(2);
    expect(itemId()).toMatch(/^[a-z0-9]{16}$/);
  });

  it('spots a bare link', () => {
    expect(onlyLink(' https://zipyzee.com/x ')).toBe('https://zipyzee.com/x');
    expect(onlyLink('see https://zipyzee.com')).toBeNull();
    expect(onlyLink('javascript:alert(1)')).toBeNull();
  });
});

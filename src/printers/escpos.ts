// ESC/POS encoding for 80mm thermal printers. printableText arrives as 42-column lines in
// logical (memory) order; printers without bidi support print left-to-right, so each line with
// Hebrew is reordered to visual order before encoding to Windows-1255.

const ESC = 0x1b;
const GS = 0x1d;

/** ESC t n code page for WPC1255 (Hebrew). 32 on Epson-compatibles; some clones use other values. */
export const HEBREW_CODEPAGE = 32;

const HEBREW = /[֐-׿]/;
const LTR_RUN = /[A-Za-z0-9.,:/%#+-]+(?: [A-Za-z0-9.,:/%#+-]+)*/g;

export function toVisualLine(line: string): string {
  if (!HEBREW.test(line)) {
    return line;
  }
  // Reverse the whole line, then flip LTR runs (numbers, latin) back so they read correctly.
  const reversed = [...line].reverse().join('');
  return reversed.replace(LTR_RUN, (run) => [...run].reverse().join(''));
}

function encodeWin1255(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp >= 0x05d0 && cp <= 0x05ea) {
      bytes.push(cp - 0x05d0 + 0xe0); // א..ת
    } else if (cp === 0x05f3 || cp === 0x05f4) {
      bytes.push(cp === 0x05f3 ? 0x27 : 0x22); // geresh / gershayim -> ' "
    } else if (cp === 0x20aa) {
      bytes.push(0xa4); // ₪
    } else {
      bytes.push(0x3f); // ?
    }
  }
  return bytes;
}

export function buildTextReceipt(text: string): Uint8Array {
  const body = text
    .split('\n')
    .map(toVisualLine)
    .join('\n');

  return Uint8Array.from([
    ESC, 0x40, // init
    ESC, 0x74, HEBREW_CODEPAGE,
    ...encodeWin1255(body),
    0x0a, 0x0a, 0x0a,
    GS, 0x56, 0x42, 0x00, // feed + partial cut
  ]);
}

export const CASH_DRAWER_COMMAND = '__COMMUNICATE_OPEN_CASH_DRAWER__';

export function buildDrawerKick(): Uint8Array {
  return Uint8Array.from([ESC, 0x70, 0x00, 0x19, 0xfa]);
}

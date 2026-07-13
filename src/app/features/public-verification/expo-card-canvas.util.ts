import { formatGender, getInitials } from './participant-format.util';

/**
 * Deterministic, device-independent expo-card renderer.
 *
 * The card is painted directly onto a fixed 540x340 canvas (ISO ID-1 ratio) at a
 * fixed pixel-ratio, so the exported PNG is byte-for-byte identical regardless of
 * device, viewport, theme, or DPR — no DOM-to-image library, no capture frame, no
 * scale/aspect conflicts (which is what left the transparent border before).
 *
 * Colours/typography mirror expo-card.html (the on-screen preview). Keep the two in
 * sync if the card design changes.
 */

export interface ExpoCardRenderData {
  eventName: string;
  dateLine: string;
  bibNumber: string;
  fullName: string;
  chipNumber?: string;
  gender?: string;
  raceName?: string;
  categoryName?: string;
  qrSrc?: string | null;
  photoSrc?: string | null;
}

const W = 540;
const H = 340;
const SCALE = 3; // -> 1620 x 1020 PNG

const COLOR = {
  border: '#e2e8f0',
  cardBg: '#ffffff',
  band: '#0f172a',
  onBand: '#ffffff',
  text: '#1e293b',
  muted: '#64748b',
  photoBg: '#94a3b8',
};

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

// Wrap into at most `maxLines` lines, ellipsising the last if it overflows.
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  const rest = words.slice(lines.join(' ').split(/\s+/).filter(Boolean).length).join(' ');
  line = line || rest;
  lines.push(ellipsize(ctx, line, maxWidth));
  return lines.slice(0, maxLines);
}

// Small calendar glyph drawn with primitives (the preview uses a PrimeIcons font
// glyph, which can't be relied on inside a canvas). `s` is the icon box size.
function drawCalendarIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 2.5, s - 1, s - 2, 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y + 5.5);
  ctx.lineTo(x + s - 0.5, y + 5.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 0.5);
  ctx.lineTo(x + 3, y + 3);
  ctx.moveTo(x + s - 3, y + 0.5);
  ctx.lineTo(x + s - 3, y + 3);
  ctx.stroke();
  ctx.restore();
}

// object-cover: fill the box, cropping overflow, centered.
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export async function renderExpoCardPng(data: ExpoCardRenderData): Promise<string> {
  const [qrImg, photoImg] = await Promise.all([
    data.qrSrc ? loadImage(data.qrSrc) : Promise.resolve(null),
    data.photoSrc ? loadImage(data.photoSrc) : Promise.resolve(null),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'top';

  // --- card background, clipped to rounded rect ---
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 16);
  ctx.fillStyle = COLOR.cardBg;
  ctx.fill();
  ctx.save();
  ctx.clip();

  // --- header band ---
  const BAND_H = 63;
  ctx.fillStyle = COLOR.band;
  ctx.fillRect(0, 0, W, BAND_H);

  // eyebrow
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `600 9.5px ${SANS}`;
  ctx.letterSpacing = '1.5px';
  ctx.fillText('MARATHON BIB EXPO', 20, 13);
  ctx.letterSpacing = '0px';

  // date (right-aligned) preceded by a calendar glyph; compute the title's right bound
  let titleMaxRight = W - 20;
  if (data.dateLine) {
    ctx.font = `500 10.5px ${SANS}`;
    const dateW = Math.ceil(ctx.measureText(data.dateLine).width);
    const dateX = W - 20 - dateW;
    const iconW = 11;
    const iconX = dateX - 6 - iconW;
    drawCalendarIcon(ctx, iconX, 32, iconW, 'rgba(255,255,255,0.8)');
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'left';
    ctx.fillText(data.dateLine, dateX, 31);
    titleMaxRight = iconX - 12;
  }

  // title (event name), single line, truncated to fit
  ctx.fillStyle = COLOR.onBand;
  ctx.font = `800 19px ${SANS}`;
  ctx.letterSpacing = '-0.3px';
  ctx.fillText(ellipsize(ctx, data.eventName, titleMaxRight - 20), 20, 28);
  ctx.letterSpacing = '0px';

  // --- body geometry ---
  const bodyTop = BAND_H + 16;
  const bodyH = H - 16 - bodyTop;
  const photoColX = 20;
  const photoColW = 124;
  const detailsX = 160;
  const detailsW = 208;
  const qrColX = 384;
  const qrColW = 136;

  // --- photo + identity column ---
  const pbW = 96;
  const pbH = 112;
  const pbX = photoColX + (photoColW - pbW) / 2;
  const pbY = bodyTop;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pbX, pbY, pbW, pbH, 12);
  ctx.clip();
  if (photoImg) {
    drawCover(ctx, photoImg, pbX, pbY, pbW, pbH);
  } else {
    ctx.fillStyle = COLOR.photoBg;
    ctx.fillRect(pbX, pbY, pbW, pbH);
    ctx.fillStyle = COLOR.cardBg;
    ctx.font = `700 30px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getInitials(data.fullName), pbX + pbW / 2, pbY + pbH / 2 + 2);
  }
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const nameCX = photoColX + photoColW / 2;
  let cursorY = pbY + pbH + 9;
  ctx.fillStyle = COLOR.text;
  ctx.font = `700 14px ${SANS}`;
  for (const line of wrapLines(ctx, data.fullName, photoColW, 2)) {
    ctx.fillText(line, nameCX, cursorY);
    cursorY += 17;
  }

  const genderLabel = formatGender(data.gender);
  if (genderLabel) {
    cursorY += 2;
    ctx.fillStyle = COLOR.muted;
    ctx.font = `400 11px ${SANS}`;
    ctx.letterSpacing = '0.9px';
    ctx.fillText(genderLabel.toUpperCase(), nameCX, cursorY);
    ctx.letterSpacing = '0px';
  }

  // --- details column (vertically centered) ---
  ctx.textAlign = 'left';
  const label = (text: string, x: number, y: number) => {
    ctx.fillStyle = COLOR.muted;
    ctx.font = `600 9px ${SANS}`;
    ctx.letterSpacing = '1.26px';
    ctx.fillText(text, x, y);
    ctx.letterSpacing = '0px';
  };

  interface Block {
    h: number;
    draw: (top: number) => void;
  }
  const blocks: Block[] = [];

  blocks.push({
    h: 55,
    draw: (top) => {
      label('BIB NUMBER', detailsX, top);
      ctx.fillStyle = COLOR.text;
      ctx.font = `600 42px ${MONO}`;
      ctx.fillText(data.bibNumber, detailsX, top + 13);
    },
  });

  if (data.chipNumber) {
    blocks.push({
      h: 1,
      draw: (top) => {
        ctx.fillStyle = COLOR.border;
        ctx.fillRect(detailsX, top, detailsW, 1);
      },
    });
    blocks.push({
      h: 29,
      draw: (top) => {
        label('CHIP', detailsX, top);
        ctx.fillStyle = COLOR.text;
        ctx.font = `600 13px ${MONO}`;
        ctx.fillText(data.chipNumber!, detailsX, top + 13);
      },
    });
  }

  if (data.raceName || data.categoryName) {
    blocks.push({
      h: 29,
      draw: (top) => {
        let colX = detailsX;
        const cell = (lbl: string, val: string) => {
          label(lbl, colX, top);
          ctx.fillStyle = COLOR.text;
          ctx.font = `600 13px ${SANS}`;
          ctx.fillText(val, colX, top + 13);
          const w = Math.max(
            ctx.measureText(val).width,
            ((): number => {
              ctx.font = `600 9px ${SANS}`;
              ctx.letterSpacing = '1.26px';
              const lw = ctx.measureText(lbl).width;
              ctx.letterSpacing = '0px';
              return lw;
            })(),
          );
          colX += w + 18;
        };
        if (data.raceName) cell('RACE', data.raceName);
        if (data.categoryName) cell('CATEGORY', data.categoryName);
      },
    });
  }

  const GAP = 11;
  const stackH = blocks.reduce((s, b) => s + b.h, 0) + GAP * (blocks.length - 1);
  let y = bodyTop + Math.max(0, (bodyH - stackH) / 2);
  for (const b of blocks) {
    b.draw(y);
    y += b.h + GAP;
  }

  // --- QR column (centered) ---
  const qbSize = 128;
  const qbX = qrColX + (qrColW - qbSize) / 2;
  const qbY = bodyTop + (bodyH - qbSize) / 2;
  ctx.beginPath();
  ctx.roundRect(qbX, qbY, qbSize, qbSize, 10);
  ctx.fillStyle = COLOR.cardBg;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLOR.border;
  ctx.stroke();
  if (qrImg) {
    const pad = 7;
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false; // crisp QR modules (matches image-rendering: pixelated)
    ctx.drawImage(qrImg, qbX + pad, qbY + pad, qbSize - pad * 2, qbSize - pad * 2);
    ctx.imageSmoothingEnabled = prevSmoothing;
  }

  ctx.restore(); // remove card clip

  // --- border on top ---
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, W - 1, H - 1, 16);
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLOR.border;
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

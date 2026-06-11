export interface BodySegment {
  type: 'text' | 'marker';
  content: string;
  index: number;
}

// Splits a Content template body into text + {{n}} marker segments so each
// marker can be shown alongside the variable (bodyVariables[n-1]) that fills it.
export function parseBodySegments(text: string): BodySegment[] {
  const segments: BodySegment[] = [];
  const regex = /\{\{\s*(\d+)\s*\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index), index: 0 });
    }
    segments.push({ type: 'marker', content: '', index: Number(match[1]) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex), index: 0 });
  }
  return segments;
}

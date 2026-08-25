export interface CapStringResult {
  text: string;
  truncated: boolean;
}

export function capUtf8String(value: string, cap: number, suffix = "\n[truncated]"): CapStringResult {
  if (cap <= 0) return { text: "", truncated: value.length > 0 };
  if (Buffer.byteLength(value, "utf8") <= cap) return { text: value, truncated: false };

  let marker = suffix;
  while (Buffer.byteLength(marker, "utf8") > cap) marker = marker.slice(0, -1);

  const markerBytes = Buffer.byteLength(marker, "utf8");
  const contentCap = Math.max(0, cap - markerBytes);
  let truncated = value.slice(0, contentCap);
  while (Buffer.byteLength(truncated, "utf8") > contentCap) truncated = truncated.slice(0, -1);
  return { text: `${truncated}${marker}`, truncated: true };
}

export function appendCappedUtf8(current: string, addition: string, cap: number, suffix = "\n[truncated]"): CapStringResult {
  return capUtf8String(current + addition, cap, suffix);
}

export function firstLines(value: string, maxLines: number): string[] {
  if (maxLines <= 0) return [];
  const lines: string[] = [];
  let start = 0;
  const input = value.trim();

  while (lines.length < maxLines) {
    const newline = input.indexOf("\n", start);
    if (newline === -1) {
      if (start < input.length) lines.push(input.slice(start));
      break;
    }
    lines.push(input.slice(start, newline));
    start = newline + 1;
  }

  return lines;
}

export function stripTerminalControl(value: string): string {
  return value
    // OSC sequences: ESC ] ... BEL or ESC ] ... ESC \\
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, "")
    // CSI and common ANSI escape sequences.
    .replace(/\x1B[@-Z\\-_]|\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    // Other C0 controls except tab/newline/carriage return.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

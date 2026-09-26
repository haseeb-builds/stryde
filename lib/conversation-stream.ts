export function readSseFrames(buffer: string): { frames: string[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const frames: string[] = [];
  let remainder = normalized;
  while (true) {
    const boundary = remainder.indexOf("\n\n");
    if (boundary < 0) break;
    frames.push(remainder.slice(0, boundary));
    remainder = remainder.slice(boundary + 2);
  }
  return { frames, remainder };
}

export function readSseData(frame: string): string | null {
  const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
  return data || null;
}

export function extractMessagePrefix(json: string): string {
  const match = /"message"\s*:\s*"/.exec(json);
  if (!match || match.index < 0) return "";
  const start = match.index + match[0].length;
  let escaped = false;
  let end = json.length;
  for (let index = start; index < json.length; index += 1) {
    const character = json[index];
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === '"') {
      end = index;
      break;
    }
  }
  return decodeJsonStringPrefix(json.slice(start, end));
}

function decodeJsonStringPrefix(raw: string): string {
  let output = "";
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (character !== "\\") {
      output += character;
      continue;
    }
    const escaped = raw[index + 1];
    if (!escaped) break;
    const escapes: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
    if (escapes[escaped] !== undefined) {
      output += escapes[escaped];
      index += 1;
    } else if (escaped === "u" && /^[0-9a-fA-F]{4}$/.test(raw.slice(index + 2, index + 6))) {
      output += String.fromCharCode(parseInt(raw.slice(index + 2, index + 6), 16));
      index += 5;
    } else break;
  }
  return output;
}

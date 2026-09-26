import { createHash } from "node:crypto";

// Preserve the original artifact fingerprint while making Git LF/CRLF checkouts equivalent.
// Only line endings are canonicalized; values, headers, whitespace and file order still matter.
export function datasetFingerprint(files: { name: string; content: Uint8Array }[]): string {
  const digest = createHash("sha256");
  for (const file of files) {
    digest.update(file.name);
    digest.update(Buffer.from(file.content).toString("utf8").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
  }
  return digest.digest("hex");
}

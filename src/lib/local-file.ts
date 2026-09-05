import { File } from "expo-file-system";

/**
 * The bytes of a file the phone has just written.
 *
 * Not fetch(). fetch() on a file:// URI used to work and quietly stopped --
 * it began answering with an ordinary response whose body was the text
 * "File not found", which then got uploaded as though it were the photograph.
 * Nothing threw, nothing logged, and the evidence reached the office as
 * fourteen bytes.
 *
 * Callers are expected to check what they get back before sending it.
 */
export async function bytesOf(uri: string): Promise<Uint8Array> {
  return new Uint8Array(await new File(uri).arrayBuffer());
}

/** Whether these bytes actually begin like a JPEG. */
export function looksLikeJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 1024 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

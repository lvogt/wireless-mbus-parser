export type ErrorName =
  | "CRC_ERROR"
  | "NO_AES_KEY"
  | "WRONG_AES_KEY"
  | "DECRYPTION_ERROR"
  | "DATA_RECORD_CACHE_MISSING"
  | "UNEXPECTED_STATE"
  | "UNIMPLEMENTED_FEATURE";

export class ParserError extends Error {
  name: ErrorName;

  constructor(name: ErrorName, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = name;
  }
}

// Telegram data is arbitrary radio data - reading beyond its end must not
// escape as a RangeError, so anything unexpected is wrapped and the original
// error is kept as cause.
export function toParserError(error: unknown): ParserError {
  if (error instanceof ParserError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new ParserError(
    "UNEXPECTED_STATE",
    `Failed to parse telegram: ${message}`,
    { cause: error }
  );
}

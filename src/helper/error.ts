export type ErrorName =
  | "CRC_ERROR"
  | "NO_AES_KEY"
  | "WRONG_AES_KEY"
  | "DECRYPTION_ERROR"
  | "UNEXPECTED_STATE"
  | "UNIMPLEMENTED_FEATURE";

export class ParserError extends Error {
  name: ErrorName;
  message: string;

  constructor(name: ErrorName, message: string) {
    super();
    this.name = name;
    this.message = message;
  }
}

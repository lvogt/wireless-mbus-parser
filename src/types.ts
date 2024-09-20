export interface WiredLinkLayer {
  lField: number;
  cField: number;
  aField: number;
}

export interface LinkLayer extends WiredLinkLayer {
  mField: number;
  version: number;
  type: number;

  addressRaw: Buffer;
  aFieldRaw: Buffer;

  manufacturer: string;
  typeString: string;
  meterId: string;
}

export interface ExtendedLinkLayer2 {
  ci: 0x8c;
  communicationControl: number;
  accessNumber: number;
}

export interface ExtendedLinkLayer10 extends Omit<ExtendedLinkLayer2, "ci"> {
  ci: 0x8e;
  manufacturer: number;
  address: Buffer;
}

export interface ExtendedLinkLayer8 extends Omit<ExtendedLinkLayer2, "ci"> {
  ci: 0x8d;
  sessionNumber: number;
  session: {
    enc: number;
    time: number;
    session: number;
  };
}

export type ExtendedLinkLayer16 = {
  ci: 0x8f;
} & Omit<ExtendedLinkLayer10, "ci"> &
  Omit<ExtendedLinkLayer8, "ci">;

export type ExtendedLinkLayer =
  | ExtendedLinkLayer2
  | ExtendedLinkLayer10
  | ExtendedLinkLayer8
  | ExtendedLinkLayer16;

export interface ParserState {
  data: Buffer;
  pos: number;
  key?: Buffer;
}

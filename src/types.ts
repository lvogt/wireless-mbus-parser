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

export interface ParserState {
  data: Buffer;
  pos: number;
}

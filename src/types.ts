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

export type Config = ConfigMode5 | ConfigMode7 | ConfigMode13;

export interface ConfigMode5 {
  mode: 0 | 5;
  bidirectional: boolean;
  accessability: boolean;
  synchronous: boolean;
  encryptedBlocks: number;
  content: number;
  hopCounter: number;
}

export interface ConfigMode7 {
  mode: 7;
  content: number;
  encryptedBlocks: number;
  kdfSel: number;
  keyid: number;
}

export interface ConfigMode13 {
  mode: 13;
  content: number;
  encryptedBytes: number;
  protoType: number;
}

export type ApplicationLayer =
  | ApplicationLayer0
  | ApplicationLayer4
  | ApplicationLayer12;

export interface ApplicationLayer0 {
  ci: 0x78;
  offset: number;
}

export interface ApplicationLayer4 extends Omit<ApplicationLayer0, "ci"> {
  ci: 0x7a;
  accessNo: number;
  statusCode: number;
  status: string;
  config: Config;
}

export interface ApplicationLayer12 extends Omit<ApplicationLayer4, "ci"> {
  ci: 0x72;
  meterId: number;
  meterManufacturer: number;
  meterVersion: number;
  meterDevice: number;
  meterIdString: string;
  meterDeviceString: string;
  meterManufacturerString: string;
}

export interface AuthenticationAndFragmentationLayer {
  ci: 0x90;
  afll: number;
  fclRaw: number;
  fcl: {
    mf: boolean;
    mclp: boolean;
    mlp: boolean;
    mcrp: boolean;
    macp: boolean;
    kip: boolean;
    fid: number;
  };
  mclRaw?: number;
  mcl?: {
    mlmp: boolean;
    mcmp: boolean;
    kimp: boolean;
    at: number;
  };
  kiRaw?: number;
  ki?: {
    keyVersion: number;
    kdfSelection: number;
    keyId: number;
  };
  mcr?: number;
  mac?: Buffer;
  ml?: number;
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

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

export interface MeterData {
  manufacturer: string;
  id: string;
  type: number;
  deviceType: string;
  version: number;
  status?: string;
  accessNo?: number;
  radio?: {
    manufacturer: string;
    id: string;
    type: number;
    deviceType: string;
    version: number;
  };
}

export interface ParserOptionsCommon {
  key?: Buffer;
  containsCrc?: boolean;
}

export interface ParserOptionsFull extends ParserOptionsCommon {
  verbose: true;
}

export interface ParserOptionsSimple extends ParserOptionsCommon {
  verbose?: false;
}

export type ParserOptions = ParserOptionsFull | ParserOptionsSimple;

export interface ParserResult {
  data: EvaluatedData[];
  meter: MeterData;
}

export interface ParserResultVerbose extends ParserResult {
  linkLayer: LinkLayer;
  extendedLinkLayer?: ExtendedLinkLayer;
  authenticationAndFragmentationLayer?: AuthenticationAndFragmentationLayer;
  applicationLayer: ApplicationLayer;
  dataRecords: DataRecord[];
  rawData: Buffer;
}

export interface DataRecord {
  header: DataRecordHeader;
  value: DataType;
}

export interface DataRecordHeader {
  dib: DataInformationBlock;
  vib: ValueInformationBlock;
  offset: number;
  length: number;
}

export type DataType = string | number | bigint | Buffer | null;

export interface VIFDescriptor {
  vif: number;
  legacyName: string;
  calc: (value: DataType) => DataType;
  unit: string;
  description: string;
  apply: (self: VIFDescriptor, dataRecord: DataRecord) => EvaluatedData;
}

export interface VIFEDescriptor {
  vif: number;
  legacyName: string;
  calc?: (value: DataType | Date) => DataType | Date;
  unit?: string;
  description?: string;
  apply: (
    self: VIFEDescriptor,
    dataRecord: DataRecord,
    evaluatedData: EvaluatedData
  ) => EvaluatedData;
}

export enum EvaluatedDataType {
  Number,
  BigInt,
  String,
  Date,
  DateTime,
  Buffer,
  Null,
}

export interface EvaluatedData {
  value: DataType | Date;
  unit: string;
  description: string;
  type: EvaluatedDataType;
  info: {
    legacyVif: string;
    tariff: number;
    deviceUnit: number;
    storageNo: number;
  };
}

export enum VifTable {
  Default,
  FD,
  FB,
  Plain,
  Manufacturer,
}

export interface DataInformationBlock {
  tariff: number;
  deviceUnit: number;
  storageNo: number;
  functionField: number;
  dataField: number;
}

export type PrimaryVif = PrimaryVifNumber | PrimaryVifString;

export interface PrimaryVifNumber {
  vif: number;
  table: Exclude<VifTable, VifTable.Plain>;
  extensionBitSet: boolean;
}

export interface PrimaryVifString {
  vif: number;
  table: VifTable.Plain;
  plainText: string;
  extensionBitSet: boolean;
}

export interface ValueInformationBlock {
  primary: PrimaryVif;
  extensions: number[];
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
  | ApplicationLayer12
  | ApplicationLayerCompact
  | ApplicationLayerDummy;

export interface ApplicationLayerDummy {
  ci: 0xa0 | 0xa1 | 0xa2 | 0xa3 | 0xa4 | 0xa5 | 0xa6 | 0xa7;
  offset: number;
}

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

export interface ApplicationLayerCompact extends Omit<ApplicationLayer0, "ci"> {
  ci: 0x79;
  headerCrc: number;
  frameCrc: number;
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

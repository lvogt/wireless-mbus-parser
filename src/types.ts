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

export interface ParserConfiguration {
  cachedDataRecordHeaders?: DataRecordHeadersCacheEntry[];
  // Handlers for manufacturer specific data records, by manufacturer. They
  // take precedence over the ones shipped with the parser, so a meter can be
  // decoded differently without changing the parser itself.
  manufacturerSpecificHandlers?: Record<
    string,
    ManufacturerSpecificDataRecordHandler
  >;
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
  dataRecordHeadersCrc: number;
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

export type CachedDataRecordHeaders = Omit<
  DataRecordHeader,
  "offset" | "length"
>;

export interface DataRecordHeadersCacheEntry {
  cachedDataRecordHeaders: CachedDataRecordHeaders[];
  crc: number;
  version: "v1";
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

export const EvaluatedDataType = {
  Number: "Number",
  BigInt: "BigInt",
  String: "String",
  Date: "Date",
  DateTime: "DateTime",
  Buffer: "Buffer",
  Null: "Null",
} as const;

export type EvaluatedDataType =
  (typeof EvaluatedDataType)[keyof typeof EvaluatedDataType];

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

export const VifTable = {
  Default: "Default",
  FD: "FD",
  FB: "FB",
  Plain: "Plain",
  Manufacturer: "Manufacturer",
} as const;

export type VifTable = (typeof VifTable)[keyof typeof VifTable];

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
  table: Exclude<VifTable, typeof VifTable.Plain>;
  extensionBitSet: boolean;
}

export interface PrimaryVifString {
  vif: number;
  table: typeof VifTable.Plain;
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

export interface LegacyResult {
  deviceInformation: {
    AccessNumber: number;
    Id: string;
    Manufacturer: string;
    Medium: string;
    Status: number;
    StatusString: string;
    Version: number;
    Address: string;
  };
  dataRecord: {
    number: number;
    value: string | number;
    unit: string;
    type: string;
    description: string;
    tariff: number;
    storageNo: number;
    devUnit: number;
    functionFieldText: string;
    functionField: number;
  }[];
}

// One value extracted from a manufacturer specific blob. Only the description
// is required - everything else is optional and describes the value further.
export interface ManufacturerSpecificValue {
  description: string;
  value: DataType | Date;
  unit?: string;
  legacyName?: string;
  storageNo?: number;
  tariff?: number;
}

// The raw content of a manufacturer specific data record, collected while the
// records are decoded - that is the only place where the bytes are known for
// a compact frame as well.
export interface ManufacturerSpecificBlob {
  dataRecord: DataRecord;
  data: Buffer;
}

// Decodes the content of a manufacturer specific data record. It is called
// with the raw bytes of the blob, no knowledge about telegram structures is
// needed to write one. The record itself is passed as well, for the rare case
// that a manufacturer uses several kinds of blob in one telegram.
export type ManufacturerSpecificDataRecordHandler = (
  data: Buffer,
  meterData: MeterData,
  dataRecord: DataRecord
) => ManufacturerSpecificValue[];

// Describes where a value sits inside a manufacturer specific blob, so that a
// handler can be written as data instead of code - see createManufacturerSpecificHandler().
interface ManufacturerSpecificFieldBase {
  // offset of the first byte of the field within the blob
  byte: number;
  // width of the field in bytes, little endian, 1 to 6, defaults to 1
  bytes?: number;
  unit?: string;
  legacyName?: string;
  storageNo?: number;
  tariff?: number;
}

// A single value: the whole field, one of its bits or a range of them.
export interface ManufacturerSpecificValueSpec extends ManufacturerSpecificFieldBase {
  description: string;
  // the bit of the field to report, counted from its least significant one
  bit?: number;
  // the bits of the field to report, as an inclusive range: [7, 11] are the
  // five bits starting at bit 7
  bits?: [number, number];
  // names for the possible values of the field, indexed by value - a value
  // without a name is reported as the number it is
  values?: string[];
  flags?: never;
}

// A group of flags: one value per named bit of the field, counted from its
// least significant one. Reserved bits are named null and are not reported.
export interface ManufacturerSpecificFlagsSpec extends ManufacturerSpecificFieldBase {
  flags: (string | null)[];
  description?: never;
}

export type ManufacturerSpecificFieldSpec =
  ManufacturerSpecificValueSpec | ManufacturerSpecificFlagsSpec;

// The fields of one kind of blob, together with the conditions under which
// they describe it. A layout without conditions applies to every blob.
export interface ManufacturerSpecificLayout {
  // the device type(s) this layout describes
  deviceType?: number | number[];
  // the primary VIF of the data record this layout describes, for a
  // manufacturer which uses several kinds of blob in one telegram
  vif?: number;
  fields: ManufacturerSpecificFieldSpec[];
}

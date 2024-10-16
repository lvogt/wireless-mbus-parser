import {
  AES_BLOCK_SIZE,
  CI_RESP_0,
  CI_RESP_4,
  CI_RESP_12,
  CI_RESP_COMPACT,
  CI_RESP_PRIOS,
  CI_RESP_SML_4,
  CI_RESP_SML_12,
  CI_RESP_TECHEM,
} from "@/helper/constants";
import { calcKenc, checkAflMac, decryptInPlace } from "@/helper/crypto";
import {
  decodeManufacturer,
  getDeviceState,
  getDeviceType,
  getMeterId,
  isLinkLayer,
} from "@/helper/helper";
import { decodePriosApplicationLayer } from "@/parser/priosApplicationLayer";
import { decodeTechemApplicationLayer } from "@/parser/techemApplicationLayer";
import type {
  ApplicationLayer,
  ApplicationLayer4,
  ApplicationLayer12,
  ApplicationLayerCompact,
  AuthenticationAndFragmentationLayer,
  Config,
  ConfigMode5,
  ConfigMode7,
  ConfigMode13,
  LinkLayer,
  ParserState,
  WiredLinkLayer,
} from "@/types";

function getApplicationLayerCompact(
  data: Buffer,
  pos: number,
  aplOffset: number
): {
  newPos: number;
  apl: ApplicationLayerCompact;
} {
  const headerCrc = data.readUInt16LE(pos);
  pos += 2;
  const frameCrc = data.readUInt16LE(pos);
  pos += 2;

  return {
    newPos: pos,
    apl: {
      ci: CI_RESP_COMPACT,
      offset: aplOffset,
      headerCrc: headerCrc,
      frameCrc: frameCrc,
    },
  };
}

function getApplicationLayer4(
  data: Buffer,
  pos: number,
  aplOffset: number
): {
  newPos: number;
  apl: ApplicationLayer4;
} {
  const accessNo = data[pos++];
  const statusCode = data[pos++];
  const status = getDeviceState(statusCode);

  const { config, newPos } = getConfig(data, pos);
  return {
    newPos,
    apl: {
      ci: CI_RESP_4,
      offset: aplOffset,
      accessNo,
      statusCode,
      status,
      config,
    },
  };
}

function getApplicationLayer12(
  data: Buffer,
  pos: number,
  aplOffset: number
): {
  newPos: number;
  apl: ApplicationLayer12;
} {
  const meterId = data.readUInt32LE(pos);
  pos += 4;
  const meterManufacturer = data.readUInt16LE(pos);
  pos += 2;
  const meterVersion = data[pos++];
  const meterDevice = data[pos++];

  const apl4 = getApplicationLayer4(data, pos, aplOffset);

  return {
    newPos: apl4.newPos,
    apl: {
      ...apl4.apl,
      ci: CI_RESP_12,
      meterId,
      meterIdString: getMeterId(meterId),
      meterManufacturer,
      meterManufacturerString: decodeManufacturer(meterManufacturer),
      meterVersion,
      meterDevice,
      meterDeviceString: getDeviceType(meterDevice),
    },
  };
}

function getDummyLinkLayer(ll: LinkLayer | WiredLinkLayer): LinkLayer {
  if (isLinkLayer(ll)) {
    return ll;
  } else {
    return {
      lField: ll.lField,
      mField: 0,
      cField: ll.cField,
      aField: ll.aField,
      version: 0,
      type: 0,

      addressRaw: Buffer.alloc(8),
      aFieldRaw: Buffer.alloc(6),

      manufacturer: "AAA",
      typeString: "unknown",
      meterId: "00000000",
    };
  }
}

function mockLinkLayerFromApplicationLayer(
  apl: ApplicationLayer,
  ll: WiredLinkLayer | LinkLayer
): LinkLayer {
  if (isLinkLayer(ll)) {
    return ll;
  }

  if (apl.ci !== CI_RESP_12) {
    return getDummyLinkLayer(ll);
  }

  // copy over application data meter and address info to link layer data for compatibility
  const addressRaw = Buffer.alloc(8);
  addressRaw.writeUInt32LE(apl.meterManufacturer, 0);
  addressRaw.writeUInt32LE(apl.meterId, 2);
  addressRaw[6] = apl.meterVersion;
  addressRaw[7] = apl.meterDevice;

  return {
    lField: ll.lField,
    mField: apl.meterManufacturer,
    cField: ll.cField,
    aField: ll.aField,
    version: apl.meterVersion,
    type: apl.meterDevice,

    addressRaw: addressRaw,
    aFieldRaw: addressRaw.subarray(2),

    manufacturer: apl.meterManufacturerString,
    typeString: apl.meterDeviceString,
    meterId: apl.meterIdString,
  };
}

function getConfig5(mode: 0 | 5, cw: number): ConfigMode5 {
  return {
    mode: mode,
    bidirectional: (cw & 0b1000000000000000) !== 0,
    accessability: (cw & 0b0100000000000000) !== 0,
    synchronous: (cw & 0b0010000000000000) !== 0,
    encryptedBlocks: (cw & 0b0000000011110000) >> 4,
    content: (cw & 0b0000000000001100) >> 2,
    hopCounter: cw & 0b0000000000000011,
  };
}

function getConfig7(mode: 7, cw: number, cwe: number): ConfigMode7 {
  return {
    mode: mode,
    content: (cw & 0b1100000000000000) >> 14,
    encryptedBlocks: (cw & 0b0000000011110000) >> 4,
    kdfSel: (cwe & 0b00110000) >> 4,
    keyid: cwe & 0b00001111,
  };
}

function getConfig13(mode: 13, cw: number, cwe: number): ConfigMode13 {
  return {
    mode: mode,
    content: (cw & 0b1100000000000000) >> 14,
    encryptedBytes: cw & 0b0000000011111111,
    protoType: cwe & 0b00001111,
  };
}

function getConfig(
  data: Buffer,
  pos: number
): {
  config: Config;
  newPos: number;
} {
  const cw = data.readUInt16LE(pos);
  pos += 2;

  const mode = (cw & 0b0001111100000000) >> 8;
  switch (mode) {
    case 0:
    case 5:
      return { config: getConfig5(mode, cw), newPos: pos };
    case 7:
      return { config: getConfig7(mode, cw, data[pos]), newPos: pos + 1 };
    case 13:
      return { config: getConfig13(mode, cw, data[pos]), newPos: pos + 1 };
    default:
      throw new Error(`Unhandled config mode ${mode}`);
  }
}

function createIvMode7() {
  return Buffer.alloc(16, 0x00);
}

function createIvMode5(
  apl: ApplicationLayer4 | ApplicationLayer12,
  ll: LinkLayer
) {
  const iv = Buffer.alloc(16, apl.accessNo);
  if (apl.ci === CI_RESP_4) {
    ll.addressRaw.copy(iv, 0);
  } else {
    iv.writeUInt16LE(apl.meterManufacturer, 0);
    iv.writeUInt32LE(apl.meterId, 2);
    iv.writeUInt8(apl.meterVersion, 6);
    iv.writeUInt8(apl.meterDevice, 7);
  }
  return iv;
}

function isPrios(linkLayer: LinkLayer | WiredLinkLayer, ci: number) {
  return (
    isLinkLayer(linkLayer) &&
    linkLayer.manufacturer === "DME" &&
    CI_RESP_PRIOS.includes(ci)
  );
}

function isTechem(linkLayer: LinkLayer | WiredLinkLayer, ci: number) {
  return (
    isLinkLayer(linkLayer) &&
    linkLayer.manufacturer === "TCH" &&
    CI_RESP_TECHEM.includes(ci)
  );
}
export async function decodeApplicationLayer(
  state: ParserState,
  linkLayer: LinkLayer | WiredLinkLayer,
  afl?: AuthenticationAndFragmentationLayer
): Promise<{
  state: ParserState;
  applicationLayer: ApplicationLayer;
  linkLayer: LinkLayer;
}> {
  const data = state.data;
  let pos = state.pos;

  const offset = pos;
  const ci = data[pos++];

  if (ci === CI_RESP_SML_4 || ci === CI_RESP_SML_12) {
    throw new Error("Payload is SML encoded. SML decoding is not implemented");
  }

  if (ci === CI_RESP_0) {
    return {
      state: { ...state, pos: pos },
      applicationLayer: { ci, offset },
      linkLayer: getDummyLinkLayer(linkLayer),
    };
  } else if (ci === CI_RESP_COMPACT) {
    const { newPos, apl } = getApplicationLayerCompact(data, pos, offset);
    return {
      state: { ...state, pos: newPos },
      applicationLayer: apl,
      linkLayer: getDummyLinkLayer(linkLayer),
    };
  }

  let apl: ApplicationLayer4 | ApplicationLayer12;
  let ll: LinkLayer;

  if (ci === CI_RESP_4 || ci === CI_RESP_12) {
    const res =
      ci === CI_RESP_4
        ? getApplicationLayer4(data, pos, offset)
        : getApplicationLayer12(data, pos, offset);
    pos = res.newPos;
    apl = res.apl;
    ll = mockLinkLayerFromApplicationLayer(apl, linkLayer);
  } else if (isPrios(linkLayer, ci)) {
    return decodePriosApplicationLayer(state, linkLayer);
  } else if (isTechem(linkLayer, ci)) {
    return decodeTechemApplicationLayer(state, linkLayer as LinkLayer);
  } else {
    throw new Error(
      `Unsupported CI Field 0x${ci.toString(16)}\nremaining payload is ${data.toString("hex", pos)}`
    );
  }

  let decryptedData: Buffer;

  if (apl.config.mode !== 0) {
    if (state.key === undefined) {
      throw new Error("Encrypted telegram but no AES key provided");
    }

    if (apl.config.mode === 5) {
      const encryptedLength = apl.config.encryptedBlocks * AES_BLOCK_SIZE;
      decryptedData = decryptInPlace(
        data,
        state.key,
        createIvMode5(apl, ll),
        "aes-128-cbc",
        pos,
        encryptedLength
      );
    } else if (apl.config.mode === 7) {
      if (afl === undefined) {
        throw new Error("Mode 7 encryption but no AFL found");
      }
      const encryptedLength = apl.config.encryptedBlocks * AES_BLOCK_SIZE;
      const { kenc, kmac } = await calcKenc(state.key, {
        ll,
        afl,
        apl,
      });
      const msgData = data.subarray(apl.offset, pos + encryptedLength);
      await checkAflMac(kmac, msgData, afl);

      decryptedData = decryptInPlace(
        data,
        kenc,
        createIvMode7(),
        "aes-128-cbc",
        pos,
        encryptedLength
      );
    } else {
      throw new Error(
        `Encryption mode ${apl.config.mode.toString(16)} not implemented`
      );
    }
  }

  return {
    state: {
      ...state,
      pos: pos,
      data: decryptedData ?? data,
    },
    applicationLayer: apl,
    linkLayer: ll,
  };
}

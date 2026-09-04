import { checkCrcEll } from "@/crc/crcCalc";
import {
  CI_ELL,
  CI_ELL_2,
  CI_ELL_8,
  CI_ELL_10,
  CI_ELL_16,
} from "@/helper/constants";
import { decryptRange } from "@/helper/crypto";
import { ParserError } from "@/helper/error";
import { isLinkLayer } from "@/helper/helper";
import { log } from "@/helper/logger";
import type {
  ExtendedLinkLayer,
  ExtendedLinkLayer8,
  ExtendedLinkLayer16,
  LinkLayer,
  ParserState,
  WiredLinkLayer,
} from "@/types";

export function hasExtendedLinkLayer(state: ParserState) {
  return CI_ELL.includes(state.data[state.pos]);
}

export function decodeExtendedLinkLayer(
  state: ParserState,
  linkLayer: LinkLayer | WiredLinkLayer
): { state: ParserState; extendedLinkLayer: ExtendedLinkLayer | undefined } {
  if (!hasExtendedLinkLayer(state)) {
    return { state, extendedLinkLayer: undefined };
  }

  const { state: newState, ell } = parseHeader(state);
  const data = newState.data;
  let pos = newState.pos;

  if (ell.ci != CI_ELL_8 && ell.ci != CI_ELL_16) {
    return { state: newState, extendedLinkLayer: ell };
  }

  if (ell.session.enc === 0) {
    return { state: newState, extendedLinkLayer: ell };
  }

  if (checkCrcEll(data, pos, data.length)) {
    log.debug(
      "ELL encryption found, but data already seems to be decrypted - CRC match"
    );
    pos += 2;
    return {
      state: { ...newState, pos },
      extendedLinkLayer: ell,
    };
  }

  if (state.key === undefined) {
    throw new ParserError("NO_AES_KEY", "Encrytped ELL, but no key provided!");
  }

  if (!isLinkLayer(linkLayer)) {
    throw new ParserError("UNEXPECTED_STATE", " wired M-bus frame and ELL!");
  }

  const iv = createIv(ell, linkLayer);
  const length = data.length - pos;

  const decryptedData = decryptRange(
    data,
    state.key,
    iv,
    "aes-128-ctr",
    pos,
    length
  );
  if (!checkCrcEll(decryptedData, pos, decryptedData.length)) {
    throw new ParserError(
      "WRONG_AES_KEY",
      "Payload CRC check failed on ExtendedLinkLayer, wrong AES key?"
    );
  }

  pos += 2;
  return {
    state: { ...newState, pos, data: decryptedData },
    extendedLinkLayer: ell,
  };
}

function createIv(
  ell: ExtendedLinkLayer8 | ExtendedLinkLayer16,
  linkLayer: LinkLayer
) {
  const iv = Buffer.alloc(16, 0x00);

  // M-field, A-field, CC, SN, 000000
  if (ell.ci == CI_ELL_16) {
    iv.writeInt16LE(ell.manufacturer, 0);
    ell.address.copy(iv, 2);
  } else {
    linkLayer.addressRaw.copy(iv, 0);
  }

  iv[8] = ell.communicationControl & 0xef; // reset hop counter
  iv.writeUInt32LE(ell.sessionNumber, 9);
  return iv;
}

// header size per CI, without the CI itself and the payload CRC
const ELL_HEADER_SIZES = {
  [CI_ELL_2]: 2,
  [CI_ELL_8]: 6,
  [CI_ELL_10]: 10,
  [CI_ELL_16]: 14,
};

function parseHeader(state: ParserState): {
  ell: ExtendedLinkLayer;
  state: ParserState;
} {
  const data = state.data;
  let pos = state.pos;

  log.debug("Extended Link Layer");
  const ci = data[pos++] as ExtendedLinkLayer["ci"];

  if (data.length < pos + ELL_HEADER_SIZES[ci]) {
    throw new ParserError(
      "UNEXPECTED_STATE",
      `Telegram is too short for an extended link layer with CI 0x${ci.toString(16)}!`
    );
  }

  // common to all headers
  const communicationControl = data[pos++];
  const accessNumber = data[pos++];

  // common to all headers
  const common = { communicationControl, accessNumber };

  if (ci == CI_ELL_2) {
    return {
      state: { ...state, pos: pos },
      ell: { ci, ...common },
    };
  }

  if (ci == CI_ELL_10) {
    const { newPos, ...address } = parseAddress(data, pos);
    return {
      state: { ...state, pos: newPos },
      ell: { ci, ...common, ...address },
    };
  }

  if (ci == CI_ELL_8) {
    const { newPos, ...session } = parseSession(data, pos);
    return {
      state: { ...state, pos: newPos },
      ell: { ci, ...common, ...session },
    };
  }

  const { newPos: posAfterAddress, ...address } = parseAddress(data, pos);
  const { newPos, ...session } = parseSession(data, posAfterAddress);
  return {
    state: { ...state, pos: newPos },
    ell: { ci, ...common, ...address, ...session },
  };
}

function parseAddress(data: Buffer, pos: number) {
  return {
    manufacturer: data.readUInt16LE(pos),
    address: data.subarray(pos + 2, pos + 8),
    newPos: pos + 8,
  };
}

function parseSession(data: Buffer, pos: number) {
  const sessionNumber = data.readUInt32LE(pos);

  return {
    sessionNumber,
    session: {
      // unsigned shift - the session number may use the full 32 bits
      enc: (sessionNumber & 0b11100000000000000000000000000000) >>> 29,
      time: (sessionNumber & 0b00011111111111111111111111110000) >> 4, //unused
      session: sessionNumber & 0b00000000000000000000000000001111, //unused
    },
    newPos: pos + 4,
  };
}

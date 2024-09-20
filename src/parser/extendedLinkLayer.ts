import { checkCrcEll } from "@/crc/crcCalc";
import {
  CI_ELL,
  CI_ELL_2,
  CI_ELL_8,
  CI_ELL_10,
  CI_ELL_16,
} from "@/helper/constants";
import { decryptInPlace } from "@/helper/crypto";
import { log } from "@/helper/logger";
import type {
  ExtendedLinkLayer,
  ExtendedLinkLayer8,
  ExtendedLinkLayer16,
  LinkLayer,
  ParserState,
} from "@/types";

export function hasExtendedLinkLayer(state: ParserState) {
  return CI_ELL.includes(state.data[state.pos]);
}

export function decodeExtendedLinkLayer(
  state: ParserState,
  linkLayer: LinkLayer
): { state: ParserState; extendedLinkLayer: ExtendedLinkLayer } {
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
      state: { ...newState, pos, data },
      extendedLinkLayer: ell,
    };
  }

  if (state.key === undefined) {
    throw new Error("Encrytped ELL, but no key provided!");
  }

  const iv = createIv(ell, linkLayer);
  const length = data.length - pos;

  const decryptedData = decryptInPlace(
    data,
    state.key,
    iv,
    "aes-128-ctr",
    pos,
    length
  );
  if (!checkCrcEll(decryptedData, pos, decryptedData.length)) {
    throw new Error(
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

function parseHeader(state: ParserState): {
  ell: ExtendedLinkLayer;
  state: ParserState;
} {
  const data = state.data;
  let pos = state.pos;

  log.debug("Extended Link Layer");
  const ci = data[pos++] as ExtendedLinkLayer["ci"];

  // common to all headers
  const communicationControl = data[pos++];
  const accessNumber = data[pos++];

  if (ci == CI_ELL_2) {
    return {
      state: {
        ...state,
        pos: pos,
        data: data,
      },
      ell: {
        ci,
        communicationControl,
        accessNumber,
      },
    };
  }

  let manufacturer: number;
  let address: Buffer;

  if (ci === CI_ELL_10 || ci === CI_ELL_16) {
    manufacturer = data.readUInt16LE(pos);
    pos += 2;
    address = data.subarray(pos, pos + 6);
    pos += 6;
  }

  if (ci == CI_ELL_10) {
    return {
      state: {
        ...state,
        pos: pos,
        data: data,
      },
      ell: {
        ci,
        communicationControl,
        accessNumber,
        manufacturer,
        address,
      },
    };
  }

  let sessionNumber: number;
  let enc: number;
  let time: number;
  let session: number;

  if (ci == CI_ELL_8 || ci == CI_ELL_16) {
    sessionNumber = data.readUInt32LE(pos);
    pos += 4;

    enc = (sessionNumber & 0b11100000000000000000000000000000) >> 29;
    time = (sessionNumber & 0b00011111111111111111111111110000) >> 4; //unused
    session = sessionNumber & 0b00000000000000000000000000001111; //unused
  }

  if (ci == CI_ELL_8) {
    return {
      state: {
        ...state,
        pos: pos,
        data: data,
      },
      ell: {
        ci,
        communicationControl,
        accessNumber,
        sessionNumber,
        session: {
          enc,
          time,
          session,
        },
      },
    };
  } else {
    return {
      state: {
        ...state,
        pos: pos,
        data: data,
      },
      ell: {
        ci,
        communicationControl,
        accessNumber,
        manufacturer,
        address,
        sessionNumber,
        session: {
          enc,
          time,
          session,
        },
      },
    };
  }
}

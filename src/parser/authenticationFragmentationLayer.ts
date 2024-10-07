import { CI_AFL } from "@/helper/constants";
import { log } from "@/helper/logger";
import type { AuthenticationAndFragmentationLayer, ParserState } from "@/types";

export function hasAuthenticationAndFragmentationLayer(state: ParserState) {
  return state.data[state.pos] === CI_AFL;
}

export function decodeAuthenticationAndFragmentationLayer(state: ParserState): {
  state: ParserState;
  authenticationAndFragmentationLayer: AuthenticationAndFragmentationLayer;
} {
  const data = state.data;
  let pos = state.pos;

  const ci = data[pos++];
  if (ci !== CI_AFL) {
    throw new Error(`Wrong AFL CI: ${ci}`);
  }
  log.debug("Authentification and Fragmentation Layer");

  const afll = data[pos++];

  const fclRaw = data.readUInt16LE(pos);
  pos += 2;

  const fcl: AuthenticationAndFragmentationLayer["fcl"] = {
    /* 0b1000000000000000 - reserved */
    mf:
      (fclRaw & 0b0100000000000000) !==
      0 /* More fragments: 0 last fragment; 1 more following */,
    mclp:
      (fclRaw & 0b0010000000000000) !==
      0 /* Message Control Field present in fragment */,
    mlp:
      (fclRaw & 0b0001000000000000) !==
      0 /* Message Length Field present in fragment */,
    mcrp:
      (fclRaw & 0b0000100000000000) !==
      0 /* Message Counter Field present in fragment */,
    macp:
      (fclRaw & 0b0000010000000000) !== 0 /* MAC Field present in fragment */,
    kip:
      (fclRaw & 0b0000001000000000) !==
      0 /* Key Information present in fragment */,
    /* 0b0000000100000000 - reserved */
    fid: fclRaw & 0b0000000011111111 /* fragment ID */,
  };

  let mclRaw: number;
  let mcl: AuthenticationAndFragmentationLayer["mcl"];

  if (fcl.mclp) {
    // AFL Message Control Field (AFL.MCL)
    mclRaw = data[pos++];
    mcl = {
      /* 0b10000000 - reserved */
      mlmp:
        (mclRaw & 0b01000000) !==
        0 /* Message Length Field present in message */,
      mcmp:
        (mclRaw & 0b00100000) !==
        0 /* Message Counter Field present in message */,
      kimp:
        (mclRaw & 0b00010000) !==
        0 /* Key Information Field present in message */,
      at: mclRaw & 0b00001111 /* Authentication-Type */,
    };
  }

  let kiRaw: number;
  let ki: AuthenticationAndFragmentationLayer["ki"];

  if (fcl.kip) {
    // AFL Key Information Field (AFL.KI)
    kiRaw = data.readUInt16LE(pos);
    pos += 2;
    ki = {
      keyVersion: (kiRaw & 0b1111111100000000) >> 8,
      /* 0b0000000011000000 - reserved */
      kdfSelection: (kiRaw & 0b0000000000110000) >> 4,
      keyId: kiRaw & 0b0000000000001111,
    };
  }

  let mcr: number;

  if (fcl.mcrp) {
    // AFL Message Counter Field (AFL.MCR)
    mcr = data.readUInt32LE(pos);
    pos += 4;
  }

  let mac: Buffer;

  if (fcl.macp) {
    if (mcl === undefined) {
      throw new Error("AFL MAC should be present but MCL is missing");
    }
    // AFL MAC Field (AFL.MAC)
    // length of the MAC field depends on AFL.MCL.AT indicated by the AFL.MCL field
    // currently only AT = 5 is used (AES-CMAC-128 8bytes truncated)
    let mac_len = 0;
    if (mcl.at == 4) {
      mac_len = 4;
    } else if (mcl.at == 5) {
      mac_len = 8;
    } else if (mcl.at == 6) {
      mac_len = 12;
    } else if (mcl.at == 7) {
      mac_len = 16;
    }
    mac = Buffer.from(data.subarray(pos, pos + mac_len));
    pos += mac_len;
    log.debug(`AFL MAC ${mac.toString("hex")}`);
  }

  let ml: number;

  if (fcl.mlp) {
    // AFL Message Length Field (AFL.ML)
    ml = data.readUInt16LE(pos);
    pos += 2;
  }

  if (fcl.mf) {
    throw new Error("Fragmented messages are not supported yet.");
  }

  return {
    state: {
      data,
      pos,
    },
    authenticationAndFragmentationLayer: {
      ci,
      afll,
      fclRaw,
      fcl,
      mclRaw,
      mcl,
      kiRaw,
      ki,
      mcr,
      mac,
      ml,
    },
  };
}

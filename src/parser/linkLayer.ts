import { DATA_LINK_LAYER_SIZE } from "@/helper/constants";
import { ParserError } from "@/helper/error";
import {
  decodeManufacturer,
  getDeviceType,
  getMeterId,
  isWiredMbusFrame,
} from "@/helper/helper";
import type { LinkLayer, ParserState, WiredLinkLayer } from "@/types";

const WIRED_DATA_LINK_LAYER_SIZE = 6;

function checkLength(data: Buffer, pos: number, size: number) {
  if (data.length < pos + size) {
    throw new ParserError(
      "UNEXPECTED_STATE",
      `Telegram is too short for a link layer! Expected at least ${pos + size} bytes, but got only ${data.length}`
    );
  }
}

export function decodeLinkLayer(state: ParserState): {
  state: ParserState;
  linkLayer: LinkLayer | WiredLinkLayer;
} {
  const { data, pos } = state;
  const isWired = isWiredMbusFrame(data);

  if (isWired) {
    checkLength(data, pos, WIRED_DATA_LINK_LAYER_SIZE);
    state.pos += WIRED_DATA_LINK_LAYER_SIZE;
    const linkLayer: WiredLinkLayer = {
      lField: data[pos + 1],
      cField: data[pos + 4],
      aField: data[pos + 5],
    };
    return { state, linkLayer };
  }

  checkLength(data, pos, DATA_LINK_LAYER_SIZE);
  state.pos += DATA_LINK_LAYER_SIZE;

  const linkLayer: LinkLayer = {
    lField: data[pos + 0],
    cField: data[pos + 1],
    mField: data.readUInt16LE(pos + 2),
    aField: data.readUInt32LE(pos + 4),
    version: data[pos + 8],
    type: data[pos + 9],

    addressRaw: Buffer.from(data.subarray(pos + 2, pos + 10)),
    aFieldRaw: Buffer.from(data.subarray(pos + 4, pos + 10)),

    manufacturer: decodeManufacturer(data.readUInt16LE(pos + 2)),
    typeString: getDeviceType(data[pos + 9]),
    meterId: getMeterId(data, pos + 4),
  };

  return { state, linkLayer };
}

import {
  decodeManufacturer,
  getDeviceType,
  getMeterId,
  isWiredMbusFrame,
} from "@/helper/helper";
import type { LinkLayer, ParserState, WiredLinkLayer } from "@/types";

export function decodeLinkLayer(state: ParserState): {
  state: ParserState;
  isWired: boolean;
  linkLayer: LinkLayer | WiredLinkLayer;
} {
  const { data, pos } = state;
  const isWired = isWiredMbusFrame(data);

  if (isWired) {
    state.pos += 6;
    const linkLayer: WiredLinkLayer = {
      lField: data[pos + 1],
      cField: data[pos + 4],
      aField: data[pos + 5],
    };
    return { state, isWired, linkLayer };
  }

  state.pos += 10;

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

  return { state, isWired, linkLayer };
}

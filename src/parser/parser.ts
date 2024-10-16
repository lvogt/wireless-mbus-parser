import { stripAnyCrc } from "@/crc/crcHandler";
import { ParserError } from "@/helper/error";
import { getMeterType, isCompactFrame } from "@/helper/helper";
import { decodeApplicationLayer } from "@/parser/applicationLayer";
import { decodeAuthenticationAndFragmentationLayer } from "@/parser/authenticationFragmentationLayer";
import {
  calcHeaderCrc,
  decodeDataRecords,
  extractDataRecordHeaders,
} from "@/parser/dataRecords";
import { evaluateDataRecords } from "@/parser/evaluatedData";
import { decodeExtendedLinkLayer } from "@/parser/extendedLinkLayer";
import { decodeLinkLayer } from "@/parser/linkLayer";
import type {
  ApplicationLayer,
  DataRecordHeader,
  ParserResult,
  ParserState,
} from "@/types";

interface ParserOptions {
  key?: Buffer;
  containsCrc?: boolean;
}

export class WirelessMbusParser {
  private dataRecordHeaderCache: Record<number, DataRecordHeader[] | null> = {};

  async parse(
    data: Buffer,
    options?: Partial<ParserOptions>
  ): Promise<ParserResult> {
    const crcFreeData = stripAnyCrc(data, options?.containsCrc);

    const state = {
      data: crcFreeData,
      pos: 0,
      key: options?.key ?? undefined,
    };

    // parserState needs to know key, and pass it on
    const { state: llState, linkLayer: llFromLinkLayer } =
      decodeLinkLayer(state);

    const { state: ellState } = decodeExtendedLinkLayer(
      llState,
      llFromLinkLayer
    );

    const { state: aflState, authenticationAndFragmentationLayer } =
      decodeAuthenticationAndFragmentationLayer(ellState);

    const {
      state: aplState,
      applicationLayer,
      linkLayer,
    } = await decodeApplicationLayer(
      aflState,
      llFromLinkLayer,
      authenticationAndFragmentationLayer
    );
    const meterType = getMeterType(linkLayer, applicationLayer);

    const dataRecords = this.handleDataRecordDecoding(
      aplState,
      applicationLayer
    );

    const evaluatedData = evaluateDataRecords(dataRecords, meterType);

    return {
      data: evaluatedData,
      type: meterType,
    };
  }

  private handleDataRecordDecoding(
    state: ParserState,
    applicationLayer: ApplicationLayer
  ) {
    if (isCompactFrame(applicationLayer)) {
      const dataRecordHeaders =
        this.dataRecordHeaderCache[applicationLayer.headerCrc];
      if (dataRecordHeaders === undefined || dataRecordHeaders === null) {
        this.dataRecordHeaderCache[applicationLayer.headerCrc] = null;
        throw new ParserError(
          "DATA_RECORD_CACHE_MISSING",
          "Compact frame received but data record cache is missing"
        );
      }
      const { dataRecords } = decodeDataRecords(state, dataRecordHeaders);
      return dataRecords;
    } else {
      const { dataRecords } = decodeDataRecords(state);

      const headerCrc = calcHeaderCrc(dataRecords, state.data);
      if (this.dataRecordHeaderCache[headerCrc] === null) {
        this.dataRecordHeaderCache[headerCrc] =
          extractDataRecordHeaders(dataRecords);
      }

      return dataRecords;
    }
  }
}

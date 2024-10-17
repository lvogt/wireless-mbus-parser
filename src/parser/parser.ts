import { stripAnyCrc } from "@/crc/crcHandler";
import { ParserError } from "@/helper/error";
import { getMeterData, isCompactFrame } from "@/helper/helper";
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
  FullParserResult,
  ParserResult,
  ParserState,
} from "@/types";

interface ParserOptions {
  key?: Buffer;
  containsCrc?: boolean;
}

export class WirelessMbusParser {
  private dataRecordHeaderCache: Record<number, DataRecordHeader[] | null> = {};

  async parseFullResult(
    data: Buffer,
    options?: Partial<ParserOptions>
  ): Promise<FullParserResult> {
    const crcFreeData = stripAnyCrc(data, options?.containsCrc);

    const state = {
      data: crcFreeData,
      pos: 0,
      key: options?.key ?? undefined,
    };

    const { state: llState, linkLayer: llFromLinkLayer } =
      decodeLinkLayer(state);

    const { state: ellState, extendedLinkLayer } = decodeExtendedLinkLayer(
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
    const meterData = getMeterData(linkLayer, applicationLayer);

    const dataRecords = this.handleDataRecordDecoding(
      aplState,
      applicationLayer
    );

    const evaluatedData = evaluateDataRecords(dataRecords, meterData);

    return {
      data: evaluatedData,
      meter: meterData,
      linkLayer,
      extendedLinkLayer,
      authenticationAndFragmentationLayer,
      applicationLayer,
      dataRecords,
      rawData: aplState.data,
    };
  }

  async parse(
    data: Buffer,
    options?: Partial<ParserOptions>
  ): Promise<ParserResult> {
    const { data: evaluatedData, meter } = await this.parseFullResult(
      data,
      options
    );
    return { data: evaluatedData, meter };
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

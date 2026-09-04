import { stripAnyCrc } from "@/crc/crcHandler";
import { ParserError, toParserError } from "@/helper/error";
import { getMeterData, isCompactFrame } from "@/helper/helper";
import { decodeApplicationLayer } from "@/parser/applicationLayer";
import { decodeAuthenticationAndFragmentationLayer } from "@/parser/authenticationFragmentationLayer";
import {
  calcHeaderCrc,
  decodeDataRecords,
  extractDataRecordHeaders,
  handleCachedDataRecordHeaders as handleDataRecordHeadersCacheEntry,
  reduceToCachedDataRecordHeaders,
} from "@/parser/dataRecords";
import { evaluateDataRecords } from "@/parser/evaluatedData";
import { decodeExtendedLinkLayer } from "@/parser/extendedLinkLayer";
import { createLegacyResult } from "@/parser/legacy";
import { decodeLinkLayer } from "@/parser/linkLayer";
import type {
  ApplicationLayer,
  DataRecordHeader,
  DataRecordHeadersCacheEntry,
  ParserConfiguration,
  ParserOptions,
  ParserOptionsCommon,
  ParserOptionsFull,
  ParserOptionsSimple,
  ParserResult,
  ParserResultVerbose,
  ParserState,
} from "@/types";

export class WirelessMbusParser {
  private dataRecordHeaderCache: Record<number, DataRecordHeader[] | null> = {};

  constructor(configuration?: ParserConfiguration) {
    for (const entry of configuration?.cachedDataRecordHeaders ?? []) {
      const { crc, dataRecordHeaders } =
        handleDataRecordHeadersCacheEntry(entry);
      this.dataRecordHeaderCache[crc] = dataRecordHeaders;
    }
  }

  get cache() {
    const entries: DataRecordHeadersCacheEntry[] = [];
    for (const [crc, entry] of Object.entries(this.dataRecordHeaderCache)) {
      if (entry !== null) {
        entries.push({
          cachedDataRecordHeaders: reduceToCachedDataRecordHeaders(entry),
          crc: +crc,
          version: "v1",
        } satisfies DataRecordHeadersCacheEntry);
      }
    }
    return entries;
  }

  async parse(
    data: Buffer,
    options: ParserOptionsFull
  ): Promise<ParserResultVerbose>;
  async parse(
    data: Buffer,
    options?: ParserOptionsSimple
  ): Promise<ParserResult>;

  async parse(
    data: Buffer,
    options?: ParserOptions
  ): Promise<ParserResultVerbose | ParserResult> {
    if (options?.verbose) {
      return this.parseFullResult(data, options);
    } else {
      return this.parseSimple(data, options);
    }
  }

  static toLegacyResult(result: ParserResultVerbose) {
    return createLegacyResult(result);
  }

  static getDataRecordHeadersCacheEntry(result: ParserResultVerbose) {
    return {
      cachedDataRecordHeaders: reduceToCachedDataRecordHeaders(
        result.dataRecords.map((record) => record.header)
      ),
      crc: result.dataRecordHeadersCrc,
      version: "v1",
    } satisfies DataRecordHeadersCacheEntry;
  }

  private async parseFullResult(
    data: Buffer,
    options?: Partial<ParserOptionsCommon>
  ): Promise<ParserResultVerbose> {
    try {
      return await this.decodeTelegram(data, options);
    } catch (error: unknown) {
      throw toParserError(error);
    }
  }

  private async decodeTelegram(
    data: Buffer,
    options?: Partial<ParserOptionsCommon>
  ): Promise<ParserResultVerbose> {
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

    const { dataRecords, headerCrc } = this.handleDataRecordDecoding(
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
      dataRecordHeadersCrc: headerCrc,
      rawData: aplState.data,
    };
  }

  private async parseSimple(
    data: Buffer,
    options?: Partial<ParserOptionsCommon>
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
      return { dataRecords, headerCrc: applicationLayer.headerCrc };
    } else {
      const { dataRecords } = decodeDataRecords(state);

      const headerCrc = calcHeaderCrc(dataRecords, state.data);
      if (this.dataRecordHeaderCache[headerCrc] === null) {
        this.dataRecordHeaderCache[headerCrc] =
          extractDataRecordHeaders(dataRecords);
      }

      return { dataRecords, headerCrc };
    }
  }
}

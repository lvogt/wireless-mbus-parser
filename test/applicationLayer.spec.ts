import { describe, expect, it } from "vitest";

import { decodeApplicationLayer } from "@/parser/applicationLayer";
import { decodeAuthenticationAndFragmentationLayer } from "@/parser/authenticationFragmentationLayer";
import { decodeExtendedLinkLayer } from "@/parser/extendedLinkLayer";
import { decodeLinkLayer } from "@/parser/linkLayer";
import type { LinkLayer } from "@/types";

async function decodeApl(data: string) {
  return await decodeApplicationLayer(
    {
      data: Buffer.from(data, "hex"),
      pos: 0,
    },
    {} as unknown as LinkLayer
  );
}

async function decodeLlAndApl(data: string, key?: string) {
  const resultLl = decodeLinkLayer({
    data: Buffer.from(data, "hex"),
    pos: 0,
  });

  return await decodeApplicationLayer(
    {
      data: Buffer.from(data, "hex"),
      pos: resultLl.state.pos,
      key: key ? Buffer.from(key, "hex") : undefined,
    },
    resultLl.linkLayer
  );
}

async function decode(data: string, key?: string) {
  const resultLl = decodeLinkLayer({
    data: Buffer.from(data, "hex"),
    pos: 0,
  });

  const resultEll = decodeExtendedLinkLayer(
    {
      data: Buffer.from(data, "hex"),
      pos: resultLl.state.pos,
      key: key ? Buffer.from(key, "hex") : undefined,
    },
    resultLl.linkLayer
  );

  const resultAfl = decodeAuthenticationAndFragmentationLayer({
    data: Buffer.from(data, "hex"),
    pos: resultEll.state.pos,
    key: key ? Buffer.from(key, "hex") : undefined,
  });

  return await decodeApplicationLayer(
    {
      data: Buffer.from(data, "hex"),
      pos: resultAfl.state.pos,
      key: key ? Buffer.from(key, "hex") : undefined,
    },
    resultLl.linkLayer,
    resultAfl.authenticationAndFragmentationLayer
  );
}

describe("Application Layer", () => {
  it("CI does not match", async () => {
    await expect(decodeApl("000000000000000000000000")).rejects.toThrow(
      "Unsupported CI Field 0x0\nremaining payload is 0000000000000000000000"
    );
  });

  it("Check fields - Noheader", async () => {
    const result = await decodeLlAndApl("2E44931578563412330378");

    expect(result.applicationLayer).toEqual({
      ci: 0x78,
      offset: 10,
    });
  });

  it("Check fields - Short header", async () => {
    const result = await decodeApl(
      "7A000000002F2F0A66360202FD971D00002F2F2F2F"
    );

    expect(result.applicationLayer).toEqual({
      ci: 0x7a,
      offset: 0,
      accessNo: 0,
      statusCode: 0,
      status: "No error",
      config: {
        mode: 0,
        bidirectional: false,
        accessability: false,
        synchronous: false,
        encryptedBlocks: 0,
        content: 0,
        hopCounter: 0,
      },
    });
  });

  it("Check fields - Long header", async () => {
    const result = await decodeApl(
      "72150101003330021d880400402f2f0e6e1001000000002f2f2f2f2f2f"
    );

    expect(result.applicationLayer).toEqual({
      ci: 0x72,
      offset: 0,
      accessNo: 136,
      statusCode: 0x04,
      status: "No error; low power",
      meterId: 0x010115,
      meterManufacturer: 0x3033,
      meterVersion: 2,
      meterDevice: 29,
      meterIdString: "00010115",
      meterDeviceString: "Reserved for sensors",
      meterManufacturerString: "LAS",
      config: {
        mode: 0,
        bidirectional: false,
        accessability: true,
        synchronous: false,
        encryptedBlocks: 0,
        content: 0,
        hopCounter: 0,
      },
    });
  });

  it("Encryption Mode 5 / Security profile A", async () => {
    const result = await decodeLlAndApl(
      "2E4493157856341233037A2A0020255923C95AAA26D1B2E7493B013EC4A6F6D3529B520EDFF0EA6DEFC99D6D69EBF3",
      "0102030405060708090A0B0C0D0E0F11"
    );

    expect(result.applicationLayer).toEqual({
      ci: 0x7a,
      offset: 10,
      accessNo: 42,
      statusCode: 0,
      status: "No error",
      config: {
        mode: 5,
        bidirectional: false,
        accessability: false,
        synchronous: true,
        encryptedBlocks: 2,
        content: 0,
        hopCounter: 0,
      },
    });
  });

  it("Long Header - Encrypted Mode 5", async () => {
    const result = await decodeLlAndApl(
      "4644a205440000570c377244000057a2050c37a3003005d898c64fd0c9bd2634365084e4df946736c71a2103e45a190caa1a49b602e46c9f45fcee79afbe34f0c167fd857f659e",
      "CAFEBABE123456789ABCDEF0CAFEBABE"
    );

    expect(result.applicationLayer).toEqual({
      ci: 0x72,
      offset: 10,
      accessNo: 163,
      statusCode: 0,
      status: "No error",
      meterId: 0x57000044,
      meterManufacturer: 0x5a2,
      meterVersion: 12,
      meterDevice: 55,
      meterIdString: "57000044",
      meterDeviceString: "Radio converter (Meter side)",
      meterManufacturerString: "AMB",
      config: {
        mode: 5,
        bidirectional: false,
        accessability: false,
        synchronous: false,
        encryptedBlocks: 3,
        content: 0,
        hopCounter: 0,
      },
    });
  });

  it("Encryption Mode 7 / Security profile B", async () => {
    const result = await decode(
      "434493157856341233038C2075900F002C25B30A000021924D4F2FB66E017A75002007109058475F4BC91DF878B80A1B0F98B629024AAC727942BFC549233C0140829B93",
      "000102030405060708090A0B0C0D0E0F"
    );

    expect(result.applicationLayer).toEqual({
      ci: 0x7a,
      offset: 30,
      accessNo: 117,
      statusCode: 0,
      status: "No error",
      config: {
        mode: 7,
        encryptedBlocks: 2,
        content: 0,
        kdfSel: 1,
        keyid: 0,
      },
    });
  });

  it("Encryption Mode 7 - MAC does not match", async () => {
    await expect(
      decode(
        "434493157856341233038C2075900F002C25B30A000021924D4F3FB66E017A75002007109058475F4BC91DF878B80A1B0F98B629024AAC727942BFC549233C0140829B93",
        "000102030405060708090A0B0C0D0E0F"
      )
    ).rejects.toThrow(
      "Received MAC does not match. Corrupted data?\nMAC received: 21924d4f3fb66e01"
    );
  });
});

describe("PRIOS", () => {
  it("Check link layer", async () => {
    const result = await decodeLlAndApl(
      "1944a511780727324120a2211a00136d7417074c0dcb9661a3ab"
    );

    expect(result.applicationLayer).toEqual({
      ci: 0xa2,
      offset: 10,
    });
  });
});

describe("Techem", () => {
  it("HCA #1 version 0x94", async () => {
    const result = await decodeLlAndApl(
      "33446850942905119480a20f9f257500902d0000018e0a760a000000000000000000000000000000000000000000000000000000"
    );

    expect(result.applicationLayer).toEqual({
      ci: 0xa2,
      offset: 10,
    });
  });

  it("HCA #2 version 0x69", async () => {
    const result = await decodeLlAndApl(
      "31446850226677116980A0119F27020480048300C408F709143C003D341A2B0B2A0707000000000000062D114457563D71A1850000"
    );

    expect(result.applicationLayer).toEqual({
      ci: 0xa0,
      offset: 10,
    });
  });
});

describe("Compact frames", () => {
  it("Compact frame but no cached structure", async () => {
    const result = await decodeLlAndApl(
      "4644a205440000570c3779C4D788B0A60B00004E11000013070000C91A0000000000000000B10B6709"
    );

    expect(result.applicationLayer).toEqual({
      ci: 0x79,
      offset: 10,
      headerCrc: 0xd7c4,
      frameCrc: 0xb088,
    });
  });
});

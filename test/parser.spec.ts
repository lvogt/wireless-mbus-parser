import { fail } from "assert";
import { describe, expect, it } from "vitest";

import { ParserError } from "@/helper/error";
import { WirelessMbusParser } from "@/parser/parser";

async function decode(data: string, key?: string) {
  const parser = new WirelessMbusParser();
  return await parser.parse(
    Buffer.from(data, "hex"),
    key ? { key: Buffer.from(key, "hex") } : undefined
  );
}

async function decodeWithError(
  data: string,
  name: string,
  message: string,
  key?: string
) {
  let result;
  try {
    result = await decode(data, key);
  } catch (e: unknown) {
    if (e instanceof ParserError) {
      expect(e.name).toEqual(name);
      expect(e.message).toEqual(message);
      return;
    } else {
      fail("Error should be of type ParserError!");
    }
  }
  console.log(JSON.stringify(result));
  fail("Did not throw!");
}

describe("Parser", () => {
  it("Simple telegram", async () => {
    const result = await decode(
      "2C44A7320613996707047A821000202F2F0C06000000000C14000000000C22224101000B5A4102000B5E4000F0"
    );

    expect(result.data).toHaveLength(5);
    expect(result.meter).toEqual({
      accessNo: 130,
      deviceType: "Heat",
      id: "67991306",
      manufacturer: "LUG",
      status: "No error (temporary)",
      type: 4,
      version: 7,
    });
  });

  it("Full result", async () => {
    const parser = new WirelessMbusParser();
    const result = await parser.parseFullResult(
      Buffer.from(
        "2C44A7320613996707047A821000202F2F0C06000000000C14000000000C22224101000B5A4102000B5E4000F0",
        "hex"
      )
    );

    expect(Object.keys(result)).toEqual([
      "data",
      "meter",
      "linkLayer",
      "extendedLinkLayer",
      "authenticationAndFragmentationLayer",
      "applicationLayer",
      "dataRecords",
      "rawData",
    ]);

    expect(result).toMatchSnapshot();
  });

  it("All fields", async () => {
    const parser = new WirelessMbusParser();
    const result = await parser.parseFullResult(
      Buffer.from(
        "434493157856341233038C2075900F002C25B30A000021924D4F2FB66E017A75002007109058475F4BC91DF878B80A1B0F98B629024AAC727942BFC549233C0140829B93",
        "hex"
      ),
      { key: Buffer.from("000102030405060708090A0B0C0D0E0F", "hex") }
    );

    expect(Object.keys(result)).toEqual([
      "data",
      "meter",
      "linkLayer",
      "extendedLinkLayer",
      "authenticationAndFragmentationLayer",
      "applicationLayer",
      "dataRecords",
      "rawData",
    ]);

    expect(result).toMatchSnapshot();
  });
});

describe("Errors", () => {
  it("ELL: Encrypted but no key", async () => {
    await decodeWithError(
      "24442D2C692845631B168D3050209CD621B006B1140AEF4953AE5B86FAFC0B00E70705B846",
      "NO_AES_KEY",
      "Encrytped ELL, but no key provided!"
    );
  });

  it("ELL: Encrypted but wrong key", async () => {
    await decodeWithError(
      "24442D2C692845631B168D3050209CD621B006B1140AEF4953AE5B86FAFC0B00E70705B846",
      "WRONG_AES_KEY",
      "Payload CRC check failed on ExtendedLinkLayer, wrong AES key?",
      "4E5508544202058100DFEFA06B0934AF"
    );
  });

  it("Mode5+7: Encrypted but no key", async () => {
    await decodeWithError(
      "2E44931578563412330333637A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3EC8A",
      "NO_AES_KEY",
      "Encrypted telegram but no AES key provided"
    );
  });

  it("Mode5: Encrypted but wrong key", async () => {
    await decodeWithError(
      "2E44931578563412330333637A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3EC8A",
      "WRONG_AES_KEY",
      "Decryption failed, wrong key?",
      "4E5508544202058100DFEFA06B0934AF"
    );
  });

  it("Mode7: Encrypted but wrong key", async () => {
    await decodeWithError(
      "434493157856341233037AC98C2075900F002C25B30A000021924D4FBA372FB66E017A75002007109058475F4BC9D1281DF878B80A1B0F98B629024AAC7279429398BFC549233C0140829B93BAA1",
      "WRONG_AES_KEY",
      "Received MAC does not match. Wrong key?\nMAC received: 21924d4f2fb66e01",
      "4E5508544202058100DFEFA06B0934AF"
    );
  });

  it("Compact frame without cache", async () => {
    await decodeWithError(
      "3F442D2C06357260190C8D207C71032F21255C79DD829283011117650000BFA80000D24F0000B1FB00000000E919FF18F7640000E8FA00000B000000DB111C0B",
      "DATA_RECORD_CACHE_MISSING",
      "Compact frame received but data record cache is missing"
    );
  });

  it("Compact frame without cache, afterwards with", async () => {
    const parser = new WirelessMbusParser();
    try {
      await parser.parse(
        Buffer.from(
          "3F442D2C06357260190C8D207C71032F21255C79DD829283011117650000BFA80000D24F0000B1FB00000000E919FF18F7640000E8FA00000B000000DB111C0B",
          "hex"
        )
      );
    } catch {
      /* empty */
    }

    expect(parser["dataRecordHeaderCache"]).toEqual({ 0x82dd: null });

    await parser.parse(
      Buffer.from(
        "5C442D2C06357260190C8D207B70032F21271D7802F9FF15011104061765000004EEFF07BFA8000004EEFF08D24F00000414B1FB000002FD170000026CE919426CFF184406F76400004414E8FA0000043B0B0000000259DB11025D1C0B",
        "hex"
      )
    );

    const result = await parser.parse(
      Buffer.from(
        "3F442D2C06357260190C8D207C71032F21255C79DD829283011117650000BFA80000D24F0000B1FB00000000E919FF18F7640000E8FA00000B000000DB111C0B",
        "hex"
      )
    );

    expect(result.data).toHaveLength(13);
    expect(parser["dataRecordHeaderCache"][0x82dd]).not.toEqual(null);
  });

  it("Cache only populated if needed", async () => {
    const parser = new WirelessMbusParser();
    await parser.parse(
      Buffer.from(
        "5C442D2C06357260190C8D207B70032F21271D7802F9FF15011104061765000004EEFF07BFA8000004EEFF08D24F00000414B1FB000002FD170000026CE919426CFF184406F76400004414E8FA0000043B0B0000000259DB11025D1C0B",
        "hex"
      )
    );

    expect(parser["dataRecordHeaderCache"]).toEqual({});
  });
});

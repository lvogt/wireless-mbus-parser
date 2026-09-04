import { describe, expect, it } from "vitest";

import { ParserError } from "@/helper/error";
import { WirelessMbusParser } from "@/parser/parser";

const TELEGRAMS = [
  // encrypted mode 5
  "2E44931578563412330333637A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3EC8A",
  // PRIOS
  "1944a511780727324120a2211a00136d7417074c0dcb9661a3ab",
  // Techem HCA and heat meter
  "33446850942905119480a20f9f257500902d0000018e0a760a000000000000000000000000000000000000000000000000000000",
  "36446850626262624543A1009F2777010060780000000A000000000000000000000000000000000000000000000000A0400000B4010000",
  // encrypted ELL
  "24442D2C692845631B168D3050209CD621B006B1140AEF4953AE5B86FAFC0B00E70705B846",
  // compact frame and its full telegram
  "5C442D2C06357260190C8D207B70032F21271D7802F9FF15011104061765000004EEFF07BFA8000004EEFF08D24F00000414B1FB000002FD170000026CE919426CFF184406F76400004414E8FA0000043B0B0000000259DB11025D1C0B",
  // wired M-Bus
  "6858586808057281052661A51170073E3000000C13000200008C1013000000008C2013000200003B3BDDBDEB0B26504701025ADB000266B900046D0C0B752B4C1300020000CC101300000000CC201300020000426C5F2C42EC7E7F2CDD16",
];

async function parse(data: Buffer, containsCrc?: boolean) {
  const parser = new WirelessMbusParser();
  return await parser.parse(data, {
    key: Buffer.alloc(16),
    containsCrc,
  });
}

async function expectParserError(data: string, message: string) {
  await expect(parse(Buffer.from(data, "hex"), false)).rejects.toThrowError(
    new ParserError("UNEXPECTED_STATE", message)
  );
}

describe("Malformed data", () => {
  it("only throws ParserErrors for mutated and truncated telegrams", async () => {
    // deterministic pseudo random mutations of valid telegrams
    let rnd = 987654321;
    const next = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff);

    const escaped: string[] = [];
    let parsed = 0;

    for (const telegram of TELEGRAMS) {
      const base = Buffer.from(telegram, "hex");

      for (let i = 0; i < 250; i++) {
        const mutated = Buffer.from(base);
        const mutations = 1 + (next() % 3);
        for (let m = 0; m < mutations; m++) {
          mutated[next() % mutated.length] = next() % 256;
        }
        const truncated = mutated.subarray(0, 1 + (next() % mutated.length));

        for (const data of [mutated, truncated]) {
          for (const containsCrc of [undefined, false, true]) {
            try {
              await parse(data, containsCrc);
              parsed++;
            } catch (error: unknown) {
              if (error instanceof ParserError) {
                continue;
              }
              const name = (error as Error).constructor.name;
              escaped.push(`${name}: ${(error as Error).message}`);
            }
          }
        }
      }
    }

    expect(escaped).toEqual([]);
    // make sure the telegrams are not rejected before they are parsed at all
    expect(parsed).toBeGreaterThan(0);
  });

  it("Telegram without a link layer", async () => {
    await expectParserError(
      "0844931578563412",
      "Telegram is too short for a link layer! Expected at least 10 bytes, but got only 8"
    );
  });

  it("Telegram without an application layer", async () => {
    await expectParserError(
      "09449315785634123303",
      "Telegram ended before the application layer!"
    );
  });

  it("Telegram without a configuration word", async () => {
    await expectParserError(
      "0d4493157856341233037a2a00",
      "Telegram ended before the configuration word!"
    );
  });

  it("Telegram too short for the extended link layer", async () => {
    await expectParserError(
      "0c4493157856341233038d305020",
      "Telegram is too short for an extended link layer with CI 0x8d!"
    );
  });

  it("Telegram too short for a data record", async () => {
    await expectParserError(
      "0f449315785634123303780413010203",
      "Telegram is too short for the announced data! Expected at least 17 bytes, but got only 16"
    );
  });

  it("Telegram too short for PRIOS coding", async () => {
    await expectParserError(
      "1244a511780727324120a2211a00136d741707",
      "Telegram is too short for PRIOS coding! Expected at least 26 bytes, but got only 19"
    );
  });

  it("Telegram too short for Techem coding", async () => {
    await expectParserError(
      "12446850942905119480a20f9f257500902d",
      "Telegram is too short for Techem coding! Expected at least 25 bytes, but got only 18"
    );
  });
});

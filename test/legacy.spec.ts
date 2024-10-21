import subProcess from "child_process";
import { describe, expect, it } from "vitest";

import { stripAnyCrc } from "@/index";
import { WirelessMbusParser } from "@/parser/parser";
import type { LegacyResult } from "@/types";

const callLegacy = false;

async function decode(data: string, key?: string, typeB = false) {
  if (callLegacy) {
    return decodeLegacy(data, key, typeB);
  } else {
    return await decodeAsLegacy(data, key);
  }
}

async function decodeAsLegacy(data: string, key?: string) {
  const parser = new WirelessMbusParser();
  const result = await parser.parse(Buffer.from(data, "hex"), {
    key: key ? Buffer.from(key, "hex") : undefined,
    verbose: true,
  });
  return WirelessMbusParser.toLegacyResult(result);
}

function decodeLegacy(data: string, key?: string, typeB = false) {
  const buf = Buffer.from(data, "hex");
  const withOutCrc = stripAnyCrc(buf);
  const withCrc = buf.length != withOutCrc.length;

  const cmd = `node ../ioBroker.wireless-mbus/lib/decode.js ${data} ${withCrc ? "withCrc" : "withOut"} ${key ? key : "none"} ${typeB ? "typeB" : ""}`;
  const result = subProcess.execSync(cmd, { encoding: "utf8" });
  return JSON.parse(result) as LegacyResult;
}

describe("JMBus Test Case", () => {
  it("Decode negative temperature", async () => {
    const data =
      "2C44A7320613996707047A821000202F2F0C06000000000C14000000000C22224101000B5A4102000B5E4000F0";
    expect(await decode(data)).toMatchSnapshot();
  });

  it("Decryption Test - Good Key", async () => {
    const data =
      "24442D2C692845631B168D3050209CD621B006B1140AEF4953AE5B86FAFC0B00E70705B846";
    const key = "4E5508544202058100DFEFA06B0934A5";
    expect(await decode(data, key)).toMatchSnapshot();
  });

  it("General Test #1", async () => {
    const data =
      "2644333003000000011B72030000003330011B542000002F2F02FD1701002F2F2F2F2F2F2F2F2F";
    expect(await decode(data)).toMatchSnapshot();
  });

  it("General Test #2", async () => {
    const data =
      "2C44A7320613996707047A2A1000202F2F0C06000000000C14000000000C22381701000B5A1702000B5E170200";
    expect(await decode(data)).toMatchSnapshot();
  });

  it("Magnetic Sensor Test #1", async () => {
    const data =
      "2644333015010100021D72150101003330021D880400402F2F0E6E1001000000002F2F2F2F2F2F";
    expect(await decode(data)).toMatchSnapshot();
  });

  it("Magnetic Sensor Test #2", async () => {
    const data =
      "2644333015010100021D72150101003330021D790400002F2F02FD971D000004FD08FC0800002F";
    expect(await decode(data)).toMatchSnapshot();
  });

  it("Short Telegram Test #1", async () => {
    const data =
      "5C442D2C06357260190C8D207B70032F21271D7802F9FF15011104061765000004EEFF07BFA8000004EEFF08D24F00000414B1FB000002FD170000026CE919426CFF184406F76400004414E8FA0000043B0B0000000259DB11025D1C0B";
    expect(await decode(data)).toMatchSnapshot();
  });

  it("Short Telegram Test #2", async () => {
    const data =
      "40442D2C713785691C0C8D2066445050201E5E780406A60B000004FF074E11000004FF08130700000414C91A000002FD170000043B000000000259B10B025D6709";
    expect(await decode(data)).toMatchSnapshot();
  });

  it("WMBus Demo Message Test #1", async () => {
    const data =
      "2C446532821851582C067AE1000000046D1906D9180C1334120000426CBF1C4C1300000000326CFFFF01FD7300";
    const key = "A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1";
    expect(await decode(data, key)).toMatchSnapshot();
  });

  it("WMBus Demo Message Test #2", async () => {
    const data =
      "4D4424346855471650077AA5204005CBDBC661B08F97A2030904C7F724F8BA4EE2AD3DF64721F0C3B96DEC142750968836B66233AE629B63C4AAC392C42E61C85179EF1453F27EDDC2E88A990F8A";
    const key = "A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1";
    expect(await decode(data, key)).toMatchSnapshot();
  });

  it("WMBus Demo Message Test #3", async () => {
    const data =
      "3644496A0228004401377232597049496A01073500202518AC74B56F3119F53981507265B808AF7D423C429550112536BDD6F25BBB63D9";
    const key = "A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1";
    expect(await decode(data, key)).toMatchSnapshot();
  });
});

describe("OMS Examples", () => {
  it("wM-Bus Meter with Security profile A", async () => {
    const data =
      "2E44931578563412330333637A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3EC8A";
    const key = "0102030405060708090A0B0C0D0E0F11";
    expect(await decode(data, key)).toMatchSnapshot();
  });

  it("wM-Bus Meter with integrated radio and Security profile B", async () => {
    const data =
      "434493157856341233037AC98C2075900F002C25B30A000021924D4FBA372FB66E017A75002007109058475F4BC9D1281DF878B80A1B0F98B629024AAC7279429398BFC549233C0140829B93BAA1";
    const key = "000102030405060708090A0B0C0D0E0F";
    expect(await decode(data, key)).toMatchSnapshot();
  });

  it("wM-Bus Meter with radio adapter and Security profile B", async () => {
    const data =
      "53082448443322110337D0468E80753A63665544330A31900F002C25E00AB30A0000AF5D74DF73A600D972785634C027129315330375002007109058475F4BC955CF1DF878B80A1B0F98B629024AAC7279429398BFC549233C0140829B93BAA1";
    const key = "000102030405060708090A0B0C0D0E0F";
    expect(await decode(data, key)).toMatchSnapshot();
  });

  it("wM-Bus Example with partial encryption", async () => {
    const data =
      "2D44934444332211553769EF7288776655934455080004100500DFE227F9A782146D1513581CD2F83F39040CFD1040C4785634128134";
    const key = "000102030405060708090A0B0C0D0E0F";
    expect(await decode(data, key)).toMatchSnapshot();
  });

  it("Frame type B", async () => {
    const data = "1444AE0C7856341201078C2027780B134365877AC5";
    expect(await decode(data, undefined, true)).toMatchSnapshot();
  });

  it("Frame type B without CRC", async () => {
    const data = "1244AE0C7856341201078C2027780B13436587";
    expect(await decode(data, undefined, true)).toMatchSnapshot();
  });

  it("DIF 64bit integer with calc", async () => {
    const data = "1744ae0c7856341201078c20277807138877665544332211";
    expect(await decode(data)).toMatchSnapshot();
  });

  it("DIF 64bit integer as manufacturer specific", async () => {
    const data = "1744ae0c7856341201078c202778077F8877665544332211";
    expect(await decode(data)).toMatchSnapshot();
  });
});

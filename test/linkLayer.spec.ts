import { describe, expect, it } from "vitest";

import { decodeApplicationLayer } from "@/parser/applicationLayer";
import { decodeLinkLayer } from "@/parser/linkLayer";

describe("Link Layer", () => {
  it("Check fields", () => {
    const result = decodeLinkLayer({
      data: Buffer.from("2E449315785634003303", "hex"),
      pos: 0,
    });

    expect(result.state.pos).toBe(10);
    expect(result.isWired).toBe(false);
    expect(result.linkLayer).toEqual({
      lField: 0x2e,
      cField: 0x44,
      mField: 0x1593,
      aField: 0x345678,
      version: 0x33,
      type: 0x03,
      addressRaw: Buffer.from("9315785634003303", "hex"),
      aFieldRaw: Buffer.from("785634003303", "hex"),
      manufacturer: "ELS",
      typeString: "Gas",
      meterId: "00345678",
    });
  });

  it("Check fields with offset", () => {
    const result = decodeLinkLayer({
      data: Buffer.from("123456789a2E449315785634003377", "hex"),
      pos: 5,
    });

    expect(result.state.pos).toBe(15);
    expect(result.isWired).toBe(false);
    expect(result.linkLayer).toEqual({
      lField: 0x2e,
      cField: 0x44,
      mField: 0x1593,
      aField: 0x345678,
      version: 0x33,
      type: 0x77,
      addressRaw: Buffer.from("9315785634003377", "hex"),
      aFieldRaw: Buffer.from("785634003377", "hex"),
      manufacturer: "ELS",
      typeString: "unknown",
      meterId: "00345678",
    });
  });

  it("Check fields - Wired M-Bus", () => {
    const result = decodeLinkLayer({
      data: Buffer.from("68585868080516", "hex"),
      pos: 0,
    });

    expect(result.state.pos).toBe(6);
    expect(result.isWired).toBe(true);
    expect(result.linkLayer).toEqual({
      lField: 0x58,
      cField: 0x08,
      aField: 0x05,
    });
  });

  it("Check fields - Wired M-Bus - after Application Layer", async () => {
    const result = decodeLinkLayer({
      data: Buffer.from(
        "6858586808057281052661A51170073E3000000C13000200008C1013000000008C2013000200003B3BDDBDEB0B26504701025ADB000266B900046D0C0B752B4C1300020000CC101300000000CC201300020000426C5F2C42EC7E7F2CDD16",
        "hex"
      ),
      pos: 0,
    });

    const aplResult = await decodeApplicationLayer(
      result.state,
      result.linkLayer
    );

    expect(aplResult.linkLayer).toEqual({
      lField: 0x58,
      cField: 0x08,
      mField: 0x11a5,
      aField: 0x05,
      version: 0x70,
      type: 0x07,
      addressRaw: Buffer.from("A511810526617007", "hex"),
      aFieldRaw: Buffer.from("810526617007", "hex"),
      manufacturer: "DME",
      typeString: "Water",
      meterId: "61260581",
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  decodeAuthenticationAndFragmentationLayer,
  hasAuthenticationAndFragmentationLayer,
} from "@/parser/authenticationFragmentationLayer";

function decodeAfl(data: string) {
  return decodeAuthenticationAndFragmentationLayer({
    data: Buffer.from(data, "hex"),
    pos: 0,
  });
}

describe("Authentication and Fragmentation Layer", () => {
  it("CI does not match", () => {
    const result = hasAuthenticationAndFragmentationLayer({
      data: Buffer.alloc(12),
      pos: 0,
    });

    expect(result).toBe(false);
  });

  it("Check fields", () => {
    const result = decodeAuthenticationAndFragmentationLayer({
      data: Buffer.from("900F002C25B30A000021924D4F2FB66E01", "hex"),
      pos: 0,
    });

    expect(result.authenticationAndFragmentationLayer).toEqual({
      ci: 0x90,
      afll: 0x0f,
      fclRaw: 0x2c00,
      fcl: {
        mf: false,
        mclp: true,
        mlp: false,
        mcrp: true,
        macp: true,
        kip: false,
        fid: 0,
      },
      mclRaw: 0x25,
      mcl: {
        mlmp: false,
        mcmp: true,
        kimp: false,
        at: 5,
      },
      mcr: 0x00000ab3,
      mac: Buffer.from("21924D4F2FB66E01", "hex"),
    });
  });

  it("Check fields - every field present", () => {
    // FCL 0x3e01: everything but "more fragments", fragment id 1, followed by
    // the message control field, the key information, the message counter, the
    // MAC and the message length
    const result = decodeAfl("9013013E75132AB30A00000102030405060708" + "2100");

    expect(result.authenticationAndFragmentationLayer).toEqual({
      ci: 0x90,
      afll: 0x13,
      fclRaw: 0x3e01,
      fcl: {
        mf: false,
        mclp: true,
        mlp: true,
        mcrp: true,
        macp: true,
        kip: true,
        fid: 1,
      },
      mclRaw: 0x75,
      mcl: {
        mlmp: true,
        mcmp: true,
        kimp: true,
        at: 5,
      },
      kiRaw: 0x2a13,
      ki: {
        keyVersion: 0x2a,
        kdfSelection: 1,
        keyId: 3,
      },
      mcr: 0x00000ab3,
      mac: Buffer.from("0102030405060708", "hex"),
      ml: 0x0021,
    });

    // the whole layer is consumed
    expect(result.state.pos).toEqual(21);
  });

  it("The length of the MAC follows the authentication type", () => {
    // FCL 0x2400: message control field and MAC present, nothing else
    const macLengths = new Map([
      [4, 4],
      [5, 8],
      [6, 12],
      [7, 16],
      // an authentication type the standard does not describe yet
      [3, 0],
    ]);

    for (const [at, length] of macLengths) {
      const mac = "aa".repeat(length);
      const result = decodeAfl(
        `900${at.toString(16)}0024` + `0${at.toString(16)}` + mac
      );

      expect(result.authenticationAndFragmentationLayer?.mcl?.at).toEqual(at);
      expect(result.authenticationAndFragmentationLayer?.mac).toEqual(
        Buffer.from(mac, "hex")
      );
      expect(result.state.pos).toEqual(5 + length);
    }
  });

  it("A MAC without a message control field", () => {
    // FCL 0x0400: the MAC is announced, but its length is only known from the
    // message control field, which is not there
    expect(() => decodeAfl("90030004")).toThrowErrorMatchingInlineSnapshot(
      "[UNEXPECTED_STATE: AFL MAC should be present but MCL is missing]"
    );
  });

  it("Fragmented messages are not supported", () => {
    // FCL 0x4000: more fragments follow
    expect(() => decodeAfl("90020040")).toThrowErrorMatchingInlineSnapshot(
      "[UNIMPLEMENTED_FEATURE: Fragmented messages are not supported yet.]"
    );
  });
});

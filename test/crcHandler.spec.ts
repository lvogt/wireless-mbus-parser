import { describe, expect, it } from "vitest";

import { stripAnyCrc } from "@/crc/crcHandler";

function checkResult(result: Buffer, expected: string) {
  const expectedBuffer = Buffer.from(expected, "hex");
  expect(result).toEqual(expectedBuffer);
}

function handleCrc(data: string, containsCrc?: boolean) {
  const inputData = Buffer.from(data, "hex");
  const result = stripAnyCrc(inputData, containsCrc);
  // modify input data to make sure returned data is new buffer
  inputData[2] = 0;
  return result;
}

describe("CRC unknown", () => {
  it("Frame Type A with CRC", () => {
    const data =
      "2E44931578563412330333637A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3EC8A";
    const expected =
      "2E4493157856341233037A2A0020255923C95AAA26D1B2E7493B013EC4A6F6D3529B520EDFF0EA6DEFC99D6D69EBF3";

    const strippedData = handleCrc(data);
    checkResult(strippedData, expected);
  });

  it("Frame Type A with CRC and trailing data", () => {
    const data =
      "2E44931578563412330333637A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3EC8A1234";
    const expected =
      "2E4493157856341233037A2A0020255923C95AAA26D1B2E7493B013EC4A6F6D3529B520EDFF0EA6DEFC99D6D69EBF3";

    const strippedData = handleCrc(data);
    checkResult(strippedData, expected);
  });

  it("Frame Type B with CRC", () => {
    const data = "1444AE0C7856341201078C2027780B134365877AC5";
    const expected = "1444AE0C7856341201078C2027780B13436587";

    const strippedData = handleCrc(data);
    checkResult(strippedData, expected);
  });

  it("Frame Type B with CRC and 3rd block", () => {
    const data =
      "8644AE0C7856341201078C2027780B134365877AC5111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111E6781234567890F4EE";
    const expected =
      "8644AE0C7856341201078C2027780B134365877AC51111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111234567890";

    const strippedData = handleCrc(data);
    checkResult(strippedData, expected);
  });

  it("Frame Type A/B without CRC", () => {
    const data =
      "2C44A7320613996707047A821000202F2F0C06000000000C14000000000C22224101000B5A4102000B5E4000F0";

    const strippedData = handleCrc(data);
    checkResult(strippedData, data);
  });

  it("Any frame type too short", () => {
    const data =
      "2C44A7320613996707047A821000202F2F0C06000000000C14000000000C22224101000B5A4102000B5E4000";

    expect(() => handleCrc(data)).toThrow(
      "Telegram data is too short! Expected at least 45 bytes, but got only 44"
    );
  });

  it("Frame Type A with CRC but too short", () => {
    const data =
      "2E44931578563412330333637A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3AA";

    expect(() => handleCrc(data)).toThrow(
      "Telegram data is too short! Expected at least 55 bytes, but got only 54"
    );
  });

  it("Frame Type A with wrong CRC", () => {
    const data =
      "2E44931578563412330333647A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3EC8A";

    expect(() => handleCrc(data)).toThrow("Frame type A CRC check failed");
  });
});

describe("CRC specified", () => {
  it("Frame Type A with CRC", () => {
    const data =
      "2E44931578563412330333637A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3EC8A";
    const expected =
      "2E4493157856341233037A2A0020255923C95AAA26D1B2E7493B013EC4A6F6D3529B520EDFF0EA6DEFC99D6D69EBF3";

    const strippedData = handleCrc(data, true);
    checkResult(strippedData, expected);
  });

  it("Frame Type A with CRC and trailing data", () => {
    const data =
      "2E44931578563412330333637A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3EC8A1234";
    const expected =
      "2E4493157856341233037A2A0020255923C95AAA26D1B2E7493B013EC4A6F6D3529B520EDFF0EA6DEFC99D6D69EBF3";

    const strippedData = handleCrc(data, true);
    checkResult(strippedData, expected);
  });

  it("Frame Type B with CRC", () => {
    const data = "1444AE0C7856341201078C2027780B134365877AC5";
    const expected = "1444AE0C7856341201078C2027780B13436587";
    const strippedData = handleCrc(data, true);
    checkResult(strippedData, expected);
  });

  it("Frame Type B with CRC and 3rd block", () => {
    const data =
      "8644AE0C7856341201078C2027780B134365877AC5111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111E6781234567890F4EE";
    const expected =
      "8644AE0C7856341201078C2027780B134365877AC51111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111234567890";

    const strippedData = handleCrc(data, true);
    checkResult(strippedData, expected);
  });

  it("Any frame type too short", () => {
    const data =
      "2C44A7320613996707047A821000202F2F0C06000000000C14000000000C22224101000B5A4102000B5E4000";

    expect(() => handleCrc(data, true)).toThrow(
      "Telegram data is too short! Expected at least 45 bytes, but got only 44"
    );
  });

  it("Frame Type A with CRC but too short", () => {
    const data =
      "2E44931578563412330333637A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3AA";

    expect(() => handleCrc(data, true)).toThrow(
      "Telegram data is too short! Expected at least 55 bytes, but got only 54"
    );
  });

  it("Frame Type A with wrong CRC", () => {
    const data =
      "2E44931578563412330333647A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3EC8A";

    expect(() => handleCrc(data, true)).toThrow(
      "Frame type A CRC check failed"
    );
  });

  it("Frame Type B with wrong CRC", () => {
    const data = "1444AE0C7856341201078C2027780B134365877AC4";

    expect(() => handleCrc(data, true)).toThrow(
      "Frame type B CRC check failed"
    );
  });

  it("Frame Type A without CRC but trailing data", () => {
    const data =
      "2C44A7320613996707047A821000202F2F0C06000000000C14000000000C22224101000B5A4102000B5E4000F05E123456";
    const expected =
      "2C44A7320613996707047A821000202F2F0C06000000000C14000000000C22224101000B5A4102000B5E4000F0";

    const strippedData = handleCrc(data, false);
    checkResult(strippedData, expected);
  });
});

describe("Wired M-Bus", () => {
  it("CRC check ok", () => {
    const data =
      "6858586808057281052661A51170073E3000000C13000200008C1013000000008C2013000200003B3BDDBDEB0B26504701025ADB000266B900046D0C0B752B4C1300020000CC101300000000CC201300020000426C5F2C42EC7E7F2CDD16";
    const expected =
      "6858586808057281052661A51170073E3000000C13000200008C1013000000008C2013000200003B3BDDBDEB0B26504701025ADB000266B900046D0C0B752B4C1300020000CC101300000000CC201300020000426C5F2C42EC7E7F2C";

    const strippedData = handleCrc(data);
    checkResult(strippedData, expected);
  });

  it("CRC check fails", () => {
    const data =
      "6858586808057281052661A51170073E3000000C13000200008C1013000000008C2013000200003B3BDDBDEB0B26504701025ADB000266B900046D0C0B752B4C1300020000CC101300000000CC201300020000426C5F2C42EC7E7F2CDE16";

    expect(() => handleCrc(data, true)).toThrow(
      "Wired M-Bus frame CRC check failed!"
    );
  });
});

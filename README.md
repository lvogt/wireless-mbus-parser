# wireless-mbus-parser

This is a pure JS parser for wireless mbus telegrams. It tries to follow
specifications from EN-13757 and OMS - but both are not fully implemented.

The missing parts are mostly either not relevant anymore or were not
necessary yet - this is especially true for the large amount of VIFs
introduced by the OMS standard.

Limited support for parsing "wired" mbus telegrams is implemented.
A few proprietary protocol are (partially) supported.

A legacy result format to (mostly) match the output from parser included in the
[iobroker.wireless-mbus](https://www.npmjs.com/package/iobroker.wireless-mbus) package
is also available.

## Features

- automatic CRC detection / handling
- ELL encryption and encryption modes 5 and 7
- compact frame handling
- Diehl PRIOS telegram are supported
- Techem heat, water and HCA meters are partially supported

## Sample Usage

```typescript
import { WirelessMbusParser } from "wireless-mbus-parser";

const data = "2E44931578563412330333637A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3EC8A";
const key = "0102030405060708090A0B0C0D0E0F11";

const parser = new WirelessMbusParser();
const evaluatedData = await parser.parse(
  Buffer.from(data, "hex"),
  { key: Buffer.from(key, "hex") }
);

const fullData = await parser.parser(
  Buffer.from(, "hex"),
  {
    verbose: true,
    containsCrc: undefined,
    key: Buffer.from(key, "hex")
  }
);

const legacyResult = WirelessMbusParser.toLegacyResult(fullData)
```

**Notes:**

If `containsCrc` is undefined, the parser tries to guess whether
the data contains CRC or not. This works if the telegram data has the
correct length, if it contains trailing data, the auto-detection
fails in some circumstances.

The legacy result can only be generated from the "verbose" result.

## TODO

- manufacturer specific "blob" handler
- TCH smoke detector?

## Changelog

### 1.0.0

- First release

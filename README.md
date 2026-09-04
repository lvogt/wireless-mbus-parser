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

const data =
  "2E44931578563412330333637A2A0020255923C95AAA26D1B2E7493BC2AD013EC4A6F6D3529B520EDFF0EA6DEFC955B29D6D69EBF3EC8A";
const key = "0102030405060708090A0B0C0D0E0F11";

const parser = new WirelessMbusParser();

const result = await parser.parse(Buffer.from(data, "hex"), {
  key: Buffer.from(key, "hex"),
});

const fullResult = await parser.parse(Buffer.from(data, "hex"), {
  verbose: true,
  containsCrc: undefined,
  key: Buffer.from(key, "hex"),
});

const legacyResult = WirelessMbusParser.toLegacyResult(fullResult);
```

**Notes:**

If `containsCrc` is undefined, the parser tries to guess whether
the data contains CRC or not. Trailing data is ignored. Only a frame
without CRC which happens to carry exactly as many trailing bytes as
its CRCs would occupy is mistaken for a frame with CRC - in that case
the CRC check fails and `containsCrc` has to be set explicitly.

The legacy result can only be generated from the "verbose" result.

## TODO

- manufacturer specific "blob" handler
- TCH smoke detector?

## Changelog

### Unreleased

- Fix Techem and PRIOS telegrams: the first data record was skipped, which
  shifted all decoded values
- Fix truncation of the current period energy of TCH heat meters
- CRC auto detection: ignore trailing data instead of failing
- `ParserError` is exported as a class, so errors can be checked with
  `instanceof` instead of comparing `name`
- `EvaluatedData.type` now describes the value which is actually returned:
  scaling a 64 bit value yields a `Number` and is no longer reported as
  `BigInt` -- in the legacy result such a value changes from string to number
- Fix the invalid date warning for type F date/times, which never triggered
- Fix the error message for unknown data record header cache versions
- Checking the AFL MAC without the required AFL fields now throws a
  `ParserError` instead of a `TypeError`
- Fix the ELL encryption flag, which was reported as a negative number if
  its most significant bit was set
- Enable the "strict" tsc option

### 1.2.0

- Provide access to data record header cache
- Data record header cache can be populated when parser object is constructed

### 1.1.0

- Enable "erasableSyntaxOnly" tsc option -- output of "type" (EvaluatedDataType) and "table" (VifTable) changes from numeric to readable string
- Do not throw on DIF_SPECIAL_FUNCTIONS

### 1.0.1

- Fix duplicate VIF in 0xFB table (thanks @mathis92)

### 1.0.0

- First release

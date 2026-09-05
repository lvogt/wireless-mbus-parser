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

## Error Handling

Everything which prevents a telegram from being parsed is thrown as a
`ParserError`. Its `name` is one of:

| Name                        | Meaning                                                |
| --------------------------- | ------------------------------------------------------ |
| `CRC_ERROR`                 | CRC check failed or the telegram is too short          |
| `NO_AES_KEY`                | the telegram is encrypted, but no key was provided     |
| `WRONG_AES_KEY`             | decryption or the MAC check failed                     |
| `DECRYPTION_ERROR`          | decryption could not be performed                      |
| `DATA_RECORD_CACHE_MISSING` | compact frame without the matching data record headers |
| `UNIMPLEMENTED_FEATURE`     | valid, but unsupported telegram content                |
| `UNEXPECTED_STATE`          | the telegram does not match the expected structure     |

```typescript
import { ParserError } from "wireless-mbus-parser";

try {
  await parser.parse(data, { key });
} catch (error) {
  if (error instanceof ParserError && error.name === "NO_AES_KEY") {
    // ...
  }
}
```

Telegram data is arbitrary radio data, so anything unexpected which is
not caught while parsing is wrapped in a `ParserError` as well - the
original error is available as its `cause`.

## Compact Frames

Compact frames (CI 0x79) contain values without the data record headers
which describe them. The headers have to be taken from a previously
received full telegram of the same meter, which the parser keeps in a
cache. Both frames reference the headers by a CRC over them, so the
parser knows which cache entry belongs to a compact frame.

The cache is only filled for meters which actually send compact frames:
if a compact frame cannot be decoded, a `ParserError` with the name
`DATA_RECORD_CACHE_MISSING` is thrown and the next full telegram of that
meter populates the cache. Therefore at least one compact frame is lost
whenever a parser is created without a cache.

To keep the cache across restarts, read it from the parser and pass it
to the constructor later on:

```typescript
import { WirelessMbusParser } from "wireless-mbus-parser";

const parser = new WirelessMbusParser({
  cachedDataRecordHeaders: JSON.parse(storedCache),
});

// ... parse telegrams ...

storedCache = JSON.stringify(parser.cache);
```

A single entry can also be created from a "verbose" result, e.g. to fill
the cache without waiting for a compact frame to be lost:

```typescript
const entry = WirelessMbusParser.getDataRecordHeadersCacheEntry(fullResult);
const parser = new WirelessMbusParser({ cachedDataRecordHeaders: [entry] });
```

## TODO

- manufacturer specific "blob" handler
- TCH smoke detector?

## Changelog

### Unreleased

- VIFs which only differ in their power of ten are generated from a range
  instead of being written out, and all VIF tables are covered by a snapshot
  listing every entry. The three range entries which scaled by `multiply(x, 1)`
  now use the identity like the rest, so they no longer throw for values which
  are not numbers.
- Techem heat meters: fix the day of the current date, which is a 16 bit field
  and was read as a single byte -- the day could only ever be 0 or 1, and a 0
  silently turned into the last day of the previous month
- Techem: the year of the current date is taken from the last period date of
  the same telegram instead of the wall clock, so a telegram no longer decodes
  differently depending on when it is parsed. Only a telegram without a usable
  last period date still falls back to the current year.

### 1.3.0

Breaking changes:

- Require node 22 -- node 20 reached its end of life in April 2026
- `EvaluatedData.type` now describes the value which is actually returned:
  scaling a 64 bit value yields a `Number` and is no longer reported as
  `BigInt` -- in the legacy result such a value changes from string to number
- Malformed telegrams always throw a `ParserError` -- reading beyond the end
  of a telegram surfaced as a `RangeError` before, and the manufacturer
  specific decoders threw plain `Error`s

Fixes:

- Fix Techem and PRIOS telegrams: the first data record was skipped, which
  shifted all decoded values
- Fix truncation of the current period energy of TCH heat meters
- CRC auto detection: ignore trailing data instead of failing
- Fix the ELL encryption flag, which was reported as a negative number if
  its most significant bit was set
- Checking the AFL MAC without the required AFL fields now throws a
  `ParserError` instead of a `TypeError`
- Fix the invalid date warning for type F date/times, which never triggered
- Fix the error message for unknown data record header cache versions

Other changes:

- `ParserError` is exported as a class, so errors can be checked with
  `instanceof` instead of comparing `name`
- Document error handling and compact frames
- Ship unminified code with source maps
- Mark the package as side effect free
- Enable the "strict" tsc option
- Update dependencies: eslint 10, vitest 5 and pnpm 11

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

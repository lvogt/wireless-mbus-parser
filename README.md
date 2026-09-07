# wireless-mbus-parser

A parser for wireless M-Bus telegrams: it turns the bytes a receiver hands you
into the values a meter sent - each with its unit, description, storage number
and tariff - along with the meter which sent them and, on request, every layer
the telegram is built from.

It follows EN 13757 and OMS as far as the meters in the field need it. What is
missing is either not relevant anymore or has not been necessary yet - most of
all the large number of VIFs the OMS standard introduced. "Wired" M-Bus
telegrams are supported to a limited extent, a few proprietary protocols
partially.

A legacy result format which mostly matches the output of the parser that used
to be part of
[iobroker.wireless-mbus](https://www.npmjs.com/package/iobroker.wireless-mbus)
is available as well.

## Features

- every layer of a telegram: link layer, extended link layer, authentication
  and fragmentation layer and application layer
- encryption modes 5 and 7, the encryption of the extended link layer and the
  MAC of the authentication and fragmentation layer
- automatic CRC detection - receivers differ in whether they strip it
- compact frames, with a cache of data record headers which can be kept across
  restarts
- manufacturer specific data records: a handler per manufacturer turns them
  into named values, and can be described instead of written
- proprietary telegrams: Diehl PRIOS, Techem heat, water and HCA meters
  (partially) and Itron smoke detectors
- ESM and CommonJS with TypeScript types, one dependency

## Installation

```sh
npm install wireless-mbus-parser
# or
pnpm add wireless-mbus-parser
```

Node 22 or newer is required. The package ships as ESM and CommonJS with
TypeScript types.

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

## Manufacturer Specific Data

Meters put data the standard does not describe into manufacturer specific data
records, often several values packed into a few bytes. Such a record is always
kept as it is - and its content is decoded additionally, if a handler for the
manufacturer exists.

A handler is called with the raw bytes of the record and returns one entry per
value it extracts. Writing one needs no knowledge about telegram structures:

```typescript
function decodeAcmeData(data: Buffer): ManufacturerSpecificValue[] {
  return [
    { description: "Backflow detected", value: data[0] & 0b1 },
    { description: "Battery", value: data[1], unit: "%" },
  ];
}
```

Only `description` and `value` are required. `unit`, `legacyName`, `storageNo`
and `tariff` are optional: storage number and tariff are taken from the record
the data came from, as is its function field, so a value of a "maximum value"
record is described as one as well.

The legacy result carries the `legacyName` of a value as its `type`, which
consumers use as an identifier - the ioBroker adapter builds the id of its
objects from it. A value which states none is named after its description:
"Warning: smoke alarm" becomes `VIF_WARNING_SMOKE_ALARM`, accents are folded
and everything else that is not a letter or a digit becomes an underscore.

The description of a handler is therefore part of what the legacy result
promises: rewording it renames the objects of everyone who receives that meter.
Use `legacyName` for a name which should not follow the wording - or for one
the description does not make a good identifier of.

Handlers are registered per manufacturer, either when the parser is created:

```typescript
const parser = new WirelessMbusParser({
  manufacturerSpecificHandlers: { ACM: decodeAcmeData },
});
```

or in `src/manufacturerSpecificData/handler.ts`, which is the place for
handlers to be shipped with the parser:

```typescript
export const manufacturerSpecificHandlers = {
  ACM: decodeAcmeData,
};
```

A handler of the configuration takes precedence over the one of the parser for
the same manufacturer, so a meter can be decoded differently without changing
the parser itself.

There is one handler per manufacturer and not one per device, because
manufacturers do not agree on how their devices are told apart: the version
field is the device version for Techem, but part of the identification number
for Itron. A handler decides for itself which meters it can decode, everything
it does not recognize yields no values:

```typescript
function decodeAcmeData(data: Buffer, meterData: MeterData) {
  return meterData.type === 0x1b ? decodeWaterMeter(data) : [];
}
```

The decoded values are appended to the data of the result, after the records of
the telegram itself, so adding a handler does not move them. The data records
are not touched at all - they describe the telegram. A handler which throws
only costs its own values.

### Describing a blob instead of decoding it

Most blobs are a fixed sequence of numbers and flags, which can be described
instead of decoded. `createManufacturerSpecificHandler()` turns such a
description into a handler. The description is plain data, so it can come from
a configuration file and does not have to be code at all:

```typescript
import { createManufacturerSpecificHandler } from "wireless-mbus-parser";

const decodeAcmeData = createManufacturerSpecificHandler([
  { byte: 0, bit: 0, description: "Backflow detected" },
  { byte: 1, description: "Battery", unit: "%" },
  { byte: 2, bytes: 3, description: "Volume", unit: "l" },
  { byte: 5, flags: ["Leakage", "Burst", null, "Removal"] },
]);
```

A field starts at `byte` and is `bytes` wide - one byte by default, at most
six, read little endian. The whole field is reported unless `bit` picks a
single bit or `bits` an inclusive range of them, which may span the bytes of
the field: `{ byte: 11, bytes: 2, bits: [7, 11] }` are the five bits starting
at bit 7. `flags` names one bit each and yields one value per name, the
reserved ones are named `null` and are not reported. `values` names the
possible values of a field: a list names the values 0, 1, 2 and so on, an
object only the ones which have a name (`{ 4: "Heat", 13: "Cooling" }`), and a
value without a name stays the number it is. `unit`, `legacyName`, `storageNo` and `tariff` are the same as
for a handler written by hand. A flag is named after the name of its bit, so a
flag whose legacy name should not follow that name is described as a `bit`
field with a `legacyName` of its own.

Several kinds of blob are described as a list of layouts. The first layout
whose conditions the blob meets decodes it, one without conditions matches
everything:

```typescript
const decodeAcmeData = createManufacturerSpecificHandler([
  { deviceType: 0x07, fields: [...] },
  { deviceType: [0x04, 0x0c], vif: 0x11, fields: [...] },
  { length: 4, index: 1, fields: [...] },
]);
```

A layout applies to the device types of `deviceType`, to records with the
primary VIF `vif`, to blobs of `length` bytes and to the blob at `index` among
the manufacturer specific records of the telegram, counted from 0. Meters which
send several blobs of the same size and VIF - Itron does - can only be told
apart by that order.

A blob which is too short for all the fields of a layout does not match it and
falls through to the next one; a blob no layout matches yields no values. A
description which is not sound - a bit outside of its field, a condition which
is not a number - throws where it is created, because that is a mistake of its
author and not of a telegram.

Everything which is not a fixed layout of numbers and flags still needs code: a
checksum, a field whose meaning depends on another one or a date. The Itron
smoke detector shipped with the parser is described declaratively,
`src/manufacturerSpecificData/itron.ts` is a complete example.

## TODO

- TCH smoke detector?

## Changelog

### Unreleased

- Manufacturer specific handlers can be passed to the parser as
  `manufacturerSpecificHandlers` of the configuration, so they no longer have
  to be part of it
- Such a handler can be described instead of written:
  `createManufacturerSpecificHandler()` builds one from a list of bytes, bits
  and named flags -- plain data, which can come from a configuration file. One
  description can hold several layouts, told apart by device type, VIF, the
  length of the blob and its position among the manufacturer specific records
  of the telegram, which is passed to every handler now.
- Values of a manufacturer specific handler are named after their description
  in the legacy result: `VIF_WARNING_SMOKE_ALARM` instead of
  `VIF_MANUFACTURER_SPECIFIC` for every one of them. The Itron descriptions are
  shorter and say which part of the meter reports a flag.

### 1.4.0

- Decode manufacturer specific data records: a handler per manufacturer turns
  the raw bytes of such a record into named values, which are appended to the
  data of the result. The data records themselves are not touched, so `data`
  can contain more entries than `dataRecords` now.
- Decode the configuration and error codes of the Itron smoke detector

### 1.3.1

Both Techem fixes change the dates a telegram decodes to.

- Techem: the year of the current date is taken from the last period date of
  the same telegram instead of the wall clock, so a telegram no longer decodes
  differently depending on when it is parsed. Only a telegram without a usable
  last period date still falls back to the current year.
- Techem heat meters: fix the day of the current date, which is a 16 bit field
  and was read as a single byte -- the day could only ever be 0 or 1, and a 0
  silently turned into the last day of the previous month
- Use the object returned by applying a VIFE: every descriptor of the shipped
  tables modifies the evaluated data in place, so one which returns a new
  object instead was silently doing nothing
- VIFs which only differ in their power of ten are generated from a range
  instead of being written out, and all VIF tables are covered by a snapshot
  listing every entry. The three range entries which scaled by `multiply(x, 1)`
  now use the identity like the rest, so they no longer throw for values which
  are not numbers.

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

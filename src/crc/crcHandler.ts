import { checkCrc } from "@/crc/crcCalc";
import {
  DATA_LINK_LAYER_SIZE,
  FRAME_A_BLOCK_SIZE,
  FRAME_B_BLOCK_SIZE,
} from "@/helper/constants";
import { ParserError } from "@/helper/error";
import { isWiredMbusFrame } from "@/helper/helper";

// the smallest frame containing a CRC is a single data link layer block
const MIN_SIZE_WITH_CRC = DATA_LINK_LAYER_SIZE + 2;

function checkFirstBlockCrc(data: Buffer) {
  return (
    data.length >= MIN_SIZE_WITH_CRC && checkCrc(data, 0, DATA_LINK_LAYER_SIZE)
  );
}

function checkFrameTypeACrc(data: Buffer) {
  if (!checkFirstBlockCrc(data)) {
    return false;
  }

  let pos = DATA_LINK_LAYER_SIZE + 2;
  const endPos = Math.min(data.length, getSizeOfTypeAWithCrc(data)) - 2;

  while (pos < data.length) {
    const end = Math.min(pos + FRAME_A_BLOCK_SIZE, endPos);
    if (!checkCrc(data, pos, end)) {
      return false;
    }
    pos += FRAME_A_BLOCK_SIZE + 2;
  }

  return true;
}

function checkFrameTypeBCrc(data: Buffer) {
  const lengthField = data[0];

  if (data.length < MIN_SIZE_WITH_CRC) {
    return false;
  }

  if (lengthField >= FRAME_B_BLOCK_SIZE) {
    // message has 3 blocks
    if (!checkCrc(data, FRAME_B_BLOCK_SIZE, data.length - 2)) {
      return false;
    }
  }

  const end = Math.min(FRAME_B_BLOCK_SIZE, data.length) - 2;
  return checkCrc(data, 0, end);
}

function stripFrameTypeACrc(data: Buffer) {
  const blocks = [];
  blocks.push(data.subarray(0, DATA_LINK_LAYER_SIZE));

  let pos = DATA_LINK_LAYER_SIZE + 2;
  const endPos = Math.min(data.length, getSizeOfTypeAWithCrc(data)) - 2;

  while (pos < data.length) {
    const end = Math.min(pos + FRAME_A_BLOCK_SIZE, endPos);
    blocks.push(data.subarray(pos, end));
    pos += FRAME_A_BLOCK_SIZE + 2;
  }

  return Buffer.concat(blocks);
}

function stripFrameTypeBCrc(data: Buffer) {
  const block12 = data.subarray(
    0,
    Math.min(FRAME_B_BLOCK_SIZE, data.length) - 2
  );

  if (data[0] >= FRAME_B_BLOCK_SIZE) {
    return Buffer.concat([
      block12,
      data.subarray(FRAME_B_BLOCK_SIZE, data.length - 2),
    ]);
  } else {
    return Buffer.from(block12);
  }
}

function getSizeOfTypeAWithCrc(data: Buffer) {
  const length = data[0] + 1;
  const appLength = length - DATA_LINK_LAYER_SIZE;
  const blockCount = Math.ceil(appLength / FRAME_A_BLOCK_SIZE);
  return length + (blockCount + 1) * 2;
}

function checkSize(data: Buffer) {
  const size = data[0] + 1;

  if (size > data.length) {
    throw new ParserError(
      "CRC_ERROR",
      `Telegram data is too short! Expected at least ${size} bytes, but got only ${data.length}`
    );
  }

  return size;
}

function stripAndCheckCrcTypeA(data: Buffer) {
  const expectedSizeTypeA = getSizeOfTypeAWithCrc(data);

  if (expectedSizeTypeA > data.length) {
    throw new ParserError(
      "CRC_ERROR",
      `Telegram data is too short! Expected at least ${expectedSizeTypeA} bytes, but got only ${data.length}`
    );
  }

  // ignore trailing data
  const sizedData =
    expectedSizeTypeA < data.length
      ? data.subarray(0, expectedSizeTypeA)
      : data;

  if (!checkFrameTypeACrc(sizedData)) {
    throw new ParserError("CRC_ERROR", "Frame type A CRC check failed!");
  }

  return stripFrameTypeACrc(sizedData);
}

// Only data which is longer than the length field can be a type A frame with
// CRC. It is treated as such if it is either long enough to hold all block
// CRCs or if at least the CRC of the first block matches - otherwise the
// additional bytes are considered to be trailing data.
function isFrameTypeAWithCrc(data: Buffer, size: number) {
  return (
    size < data.length &&
    (getSizeOfTypeAWithCrc(data) <= data.length || checkFirstBlockCrc(data))
  );
}

function stripAndCheckCrcIfExists(data: Buffer) {
  const size = checkSize(data);

  if (isFrameTypeAWithCrc(data, size)) {
    return stripAndCheckCrcTypeA(data);
  }

  // type B with CRC | type A or B without CRC - both may have trailing data
  const trimmedData = trimData(data);

  if (checkFrameTypeBCrc(trimmedData)) {
    return stripFrameTypeBCrc(trimmedData);
  } else {
    // assume without CRC - so A or B do not matter
    return Buffer.from(trimmedData);
  }
}

function stripAndCheckCrc(data: Buffer) {
  const size = checkSize(data);

  if (size == data.length) {
    // type B - the CRC is part of the length field
    if (checkFrameTypeBCrc(data)) {
      return stripFrameTypeBCrc(data);
    } else {
      throw new ParserError("CRC_ERROR", "Frame type B CRC check failed!");
    }
  } else {
    // type A with CRC (or trailing data...)
    return stripAndCheckCrcTypeA(data);
  }
}

function trimData(data: Buffer) {
  const size = data[0] + 1;
  return data.subarray(0, size);
}

function handleWiredMbusFrame(data: Buffer) {
  const size = data[1];
  if (data[2] != size) {
    throw new ParserError(
      "CRC_ERROR",
      "Telegram is not a valid wired M-Bus frame!"
    );
  }

  // check checksum
  let csum = 0;
  for (let i = 4; i < data.length - 2; i++) {
    csum = (csum + data[i]) & 0xff;
  }

  if (csum != data[data.length - 2]) {
    throw new ParserError("CRC_ERROR", "Wired M-Bus frame CRC check failed!");
  }

  return Buffer.from(data.subarray(0, data.length - 2));
}

export function stripAnyCrc(data: Buffer, containsCrc?: boolean) {
  if (isWiredMbusFrame(data)) {
    return handleWiredMbusFrame(data);
  } else if (containsCrc === undefined) {
    return stripAndCheckCrcIfExists(data);
  } else if (containsCrc) {
    return trimData(stripAndCheckCrc(data));
  } else {
    return Buffer.from(trimData(data));
  }
}

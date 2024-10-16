import { checkCrc } from "@/crc/crcCalc";
import {
  DATA_LINK_LAYER_SIZE,
  FRAME_A_BLOCK_SIZE,
  FRAME_B_BLOCK_SIZE,
} from "@/helper/constants";
import { ParserError } from "@/helper/error";
import { isWiredMbusFrame } from "@/helper/helper";

function checkFrameTypeACrc(data: Buffer) {
  if (!checkCrc(data, 0, DATA_LINK_LAYER_SIZE)) {
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

function stripAndCheckCrcIfExists(data: Buffer) {
  const size = data[0] + 1;

  if (size > data.length) {
    throw new ParserError(
      "CRC_ERROR",
      `Telegram data is too short! Expected at least ${size} bytes, but got only ${data.length}`
    );
  }

  if (size == data.length) {
    // type A without CRC | type B with or w/o CRC
    if (checkFrameTypeBCrc(data)) {
      // type with CRC
      return stripFrameTypeBCrc(data);
    } else {
      // assume without CRC - so A or B do not matter
      return Buffer.from(data);
    }
  } else {
    // type A with CRC (or trailing data...)
    if (getSizeOfTypeAWithCrc(data) > data.length) {
      throw new ParserError(
        "CRC_ERROR",
        `Telegram data is too short! Expected at least ${getSizeOfTypeAWithCrc(data)} bytes, but got only ${data.length}`
      );
    }

    if (checkFrameTypeACrc(data)) {
      return stripFrameTypeACrc(data);
    } else {
      throw new ParserError("CRC_ERROR", "Frame type A CRC check failed!");
    }
  }
}

function stripAndCheckCrc(data: Buffer) {
  const size = data[0] + 1;

  if (size > data.length) {
    throw new ParserError(
      "CRC_ERROR",
      `Telegram data is too short! Expected at least ${size} bytes, but got only ${data.length}`
    );
  }

  if (size == data.length) {
    // type B
    if (checkFrameTypeBCrc(data)) {
      // type with CRC
      return stripFrameTypeBCrc(data);
    } else {
      // assume without CRC - so A or B do not matter
      throw new ParserError("CRC_ERROR", "Frame type B CRC check failed!");
    }
  } else {
    // type A with CRC (or trailing data...)
    const expectedSizeTypeA = getSizeOfTypeAWithCrc(data);
    let sizedData = data;
    if (expectedSizeTypeA > data.length) {
      throw new ParserError(
        "CRC_ERROR",
        `Telegram data is too short! Expected at least ${getSizeOfTypeAWithCrc(data)} bytes, but got only ${data.length}`
      );
    } else if (expectedSizeTypeA < data.length) {
      sizedData = data.subarray(0, expectedSizeTypeA);
    }

    if (checkFrameTypeACrc(sizedData)) {
      return stripFrameTypeACrc(sizedData);
    } else {
      throw new ParserError("CRC_ERROR", "Frame type A CRC check failed!");
    }
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

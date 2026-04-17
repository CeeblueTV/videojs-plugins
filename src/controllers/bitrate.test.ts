import { describe, expect, it } from 'vitest';
import { bytesPerSecondToBitsPerSecond, readableByterate } from './bitrate';

describe('bitrate helpers', () => {
  it('converts bytes per second to bits per second', () => {
    expect(bytesPerSecondToBitsPerSecond(125000)).toBe(1000000);
  });

  it('formats bitrates in bits per second', () => {
    expect(readableByterate(0)).toBe('');
    expect(readableByterate(1000)).toBe('1.0 Kbps');
    expect(readableByterate(1000000)).toBe('1.0 Mbps');
  });
});

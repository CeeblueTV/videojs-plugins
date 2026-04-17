const BITS_PER_BYTE = 8;
const BITRATE_UNITS = ['bps', 'Kbps', 'Mbps', 'Gbps'];

/**
 * Convert a bitrate received in bytes per second to bits per second.
 *
 * @param {number} byterate The bitrate in bytes per second
 * @return {number} The bitrate in bits per second
 */
export function bytesPerSecondToBitsPerSecond(byterate: number): number {
  return byterate * BITS_PER_BYTE;
}

/**
 * Convert a bitrate in bits per second to a human-readable string.
 *
 * @param {number} bitrate The bitrate in bits per second
 * @return {string} The human readable string
 */
export function readableByterate(bitrate: number): string {
  if (bitrate === 0) {
    return '';
  }

  const i = Math.floor(Math.log(bitrate) / Math.log(1000));

  return `${(bitrate / Math.pow(1000, i)).toFixed(1)} ${BITRATE_UNITS[i]}`;
}

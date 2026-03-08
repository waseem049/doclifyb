import crypto from 'crypto';

/**
 * Generates a SHA-256 hash of the given object or string.
 */
export function generateHash(data: any): string {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Verifies if the current record's hash matches the data and previous hash.
 */
export function verifyHash(currentData: any, previousHash: string, currentHash: string): boolean {
    const recalculated = generateHash({ ...currentData, previousHash });
    return recalculated === currentHash;
}

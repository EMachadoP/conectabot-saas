/**
 * Normalize phone number to E.164 format (Brazilian)
 * @param input - Raw phone input (can include +, spaces, (), -)
 * @returns E.164 formatted phone or null if invalid
 */
export function normalizePhoneToE164BR(input: string): string | null {
    const digits = input.replace(/\D/g, '');
    if (!digits) return null;

    let d = digits;

    // Add country code if missing
    if (!d.startsWith('55')) {
        d = '55' + d;
    }

    // Validate length: 55 + DDD(2) + 8/9 digits
    if (d.length < 12 || d.length > 13) {
        return null;
    }

    return d;
}

/**
 * Check if string looks like a phone number
 */
export function looksLikePhone(input: string): boolean {
    const digits = input.replace(/\D/g, '');
    return digits.length >= 8; // At least 8 digits to consider it a phone
}

/**
 * Format phone for display
 * @param phone - E.164 format phone (e.g., 5511999999999)
 * @returns Formatted phone (e.g., +55 (11) 99999-9999)
 */
export function formatPhoneDisplay(phone: string): string {
    if (!phone) return '';

    // Remove country code for display
    const withoutCountry = phone.startsWith('55') ? phone.substring(2) : phone;

    if (withoutCountry.length === 11) {
        // DDD + 9 digits
        const ddd = withoutCountry.substring(0, 2);
        const part1 = withoutCountry.substring(2, 7);
        const part2 = withoutCountry.substring(7);
        return `+55 (${ddd}) ${part1}-${part2}`;
    } else if (withoutCountry.length === 10) {
        // DDD + 8 digits
        const ddd = withoutCountry.substring(0, 2);
        const part1 = withoutCountry.substring(2, 6);
        const part2 = withoutCountry.substring(6);
        return `+55 (${ddd}) ${part1}-${part2}`;
    }

    return `+${phone}`;
}

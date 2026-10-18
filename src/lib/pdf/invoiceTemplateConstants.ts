import QRCode from 'qrcode';

export const DEFAULT_INVOICE_TERMS = 
  "Please send payment within 30 days of receiving this invoice. There will be 10% interest charge per month on late invoice.";

export const DEFAULT_INVOICE_WARRANTY = 
  "New products carry the manufacturer's warranty. This warranty is strictly void if the item is physically damaged, burned, or tampered with after delivery.";

export const DEFAULT_SIGNATORY_NAME = "Mohan Sindam";
export const DEFAULT_SIGNATORY_ROLE = "Properator";
export const DEFAULT_SIGNATURE_TEXT = "Adeline Palmerston";

/**
 * Generates a crisp base64 PNG data URI QR code for payment.
 */
export async function generatePaymentQRCode(upiStringOrUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(upiStringOrUrl, {
      width: 256,
      margin: 1,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    // Fallback simple 1x1 transparent PNG data URI
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  }
}

/**
 * Returns formatted currency string based on business currency or symbol.
 */
export function formatCurrency(amount: number, currency = 'INR'): string {
  const numericAmount = Number(amount) || 0;
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '₹';
  
  return `${symbol}${numericAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

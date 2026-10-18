/**
 * Document auto-numbering utilities
 * Ensures sequential, collision-free numbering for Invoices and Quotations.
 */

export function extractDocumentSequenceNumber(docNum: string | null | undefined): number {
  if (!docNum) return 0;
  // Match trailing digits (e.g. "QT-0001" -> 1, "INV-2026-0005" -> 5)
  const match = docNum.match(/(\d+)(?!.*\d)/);
  if (!match) return 0;
  const parsed = parseInt(match[1], 10);
  return isNaN(parsed) ? 0 : parsed;
}

export function getNextDocumentNumber(
  prefix: string,
  existingDocumentNumbers: (string | null | undefined)[],
  businessCounter: number = 0
): string {
  const cleanPrefix = (prefix || '').trim().toUpperCase() || 'DOC';
  
  let maxNumber = 0;
  for (const num of existingDocumentNumbers) {
    const seq = extractDocumentSequenceNumber(num);
    if (seq > maxNumber) {
      maxNumber = seq;
    }
  }

  // Next number must be greater than business counter, highest existing number, and count of records
  const nextSeq = Math.max(businessCounter || 0, maxNumber, existingDocumentNumbers.length) + 1;
  return `${cleanPrefix}-${String(nextSeq).padStart(4, '0')}`;
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Quotation, QuotationItem, Business } from '@/types/database';

interface GenerateQuotationPDFParams {
  quotation: Quotation & { items?: QuotationItem[] };
  business: Business | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return `${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}/-`;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawWatermark(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  logoBase64: string | null,
  initials: string
) {
  const centerX = pageWidth / 2;
  const centerY = pageHeight / 2;
  const size = 120;

  doc.saveGraphicsState();
  (doc as any).setGState(new (doc as any).GState({ opacity: 0.07 }));

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', centerX - size / 2, centerY - size / 2, size, size);
    } catch { /* skip on error */ }
  } else {
    doc.setFont('times', 'bold');
    doc.setFontSize(80);
    doc.setTextColor(180, 180, 180);
    doc.text(initials, centerX, centerY, { align: 'center' });
  }

  doc.restoreGraphicsState();
  doc.setTextColor(0, 0, 0);
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateQuotationPDF({
  quotation,
  business,
}: GenerateQuotationPDFParams): Promise<jsPDF> {
  const doc        = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin     = 14;

  const businessName = (business?.business_name || 'Your Business').toUpperCase();
  const initials     = businessName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

  const logoBase64 = business?.logo_url
    ? await loadImageAsBase64(business.logo_url)
    : null;

  // ── 1. WATERMARK ─────────────────────────────────────────────────────────
  drawWatermark(doc, pageWidth, pageHeight, logoBase64, initials);

  // ── 2. HEADER ─────────────────────────────────────────────────────────────
  let yPos    = 14;
  const logoW = 22;
  const logoH = 22;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'AUTO', margin, yPos, logoW, logoH);
    } catch { /* skip */ }
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(0, 0, 0);
  doc.text(businessName, pageWidth / 2, yPos + 12, { align: 'center' });

  yPos += logoH + 4;

  // ── 3. CONTACT LINE ───────────────────────────────────────────────────────
  const contactParts: string[] = [];
  if (business?.business_address) {
    const cityState = [business.city, business.state, business.pincode].filter(Boolean).join(', ');
    contactParts.push(business.business_address + (cityState ? `, ${cityState}` : ''));
  }
  if (business?.phone_number) contactParts.push(`Mob.: ${business.phone_number}`);
  if (business?.email)        contactParts.push(`Email: ${business.email}`);

  if (contactParts.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    doc.text(contactParts.join('   |   '), pageWidth / 2, yPos, { align: 'center' });
    yPos += 5.5;
  }

  if (business?.gstin) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`GST NO.: ${business.gstin}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5.5;
  }

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // ── 4. TITLE ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('QUOTATION', pageWidth / 2, yPos, { align: 'center' });
  yPos += 9;

  // ── 5. META ───────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Date: ${format(new Date(quotation.quotation_date), 'dd-MM-yyyy')}`, margin, yPos);
  doc.text(`Quotation No.: ${quotation.quotation_number}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 5.5;

  if (quotation.valid_until) {
    doc.text(
      `Valid Until: ${format(new Date(quotation.valid_until), 'dd-MM-yyyy')}`,
      pageWidth - margin,
      yPos,
      { align: 'right' }
    );
    yPos += 5.5;
  }

  yPos += 4;

  // ── 6. CLIENT BLOCK ───────────────────────────────────────────────────────
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('To,', margin, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(quotation.client_name || '-', margin, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  if (quotation.client_address) {
    const addressLines = doc.splitTextToSize(quotation.client_address, 120) as string[];
    doc.text(addressLines, margin, yPos);
    yPos += addressLines.length * 5;
  }

  if (quotation.client_phone) {
    doc.text(`Phone: ${quotation.client_phone}`, margin, yPos);
    yPos += 5;
  }

  if (quotation.client_gstin) {
    doc.text(`GST No.: ${quotation.client_gstin}`, margin, yPos);
    yPos += 5;
  }

  yPos += 6;

  // ── 7. ITEMS TABLE ────────────────────────────────────────────────────────
  const items = quotation.items || [];

  // FIX: Read item.total (set by NewQuotation as quantity * unit_price).
  // Fallback: item.subtotal, then compute from parts.
  const tableBody = items.map((item, index) => {
    const quantity  = Number(item.quantity)   || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const total     = Number(item.total)      || Number(item.subtotal) || (quantity * unitPrice);

    const displayText = item.name?.trim()
      ? item.name + (item.description ? `\n${item.description}` : '')
      : '—';

    return [
      String(index + 1),
      displayText,
      String(quantity),
      formatAmount(unitPrice),
      formatAmount(total),
    ];
  });

 autoTable(doc, {
  startY: yPos,
  head: [['No.', 'Item Description', 'Qty', 'Rate', 'Amount']],
  body: tableBody,
  theme: 'plain',

  styles: {
    font: 'helvetica',
    fontSize: 10,
    cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    lineColor: [200, 200, 200],
    lineWidth: 0.3,
    textColor: [0, 0, 0],
    overflow: 'linebreak',
    fillColor: false,
  },

  headStyles: {
    fillColor: [30, 30, 30],
    textColor: [255, 255, 255],
    fontStyle: 'bold',
    halign: 'center',
    fontSize: 10,
  },

  alternateRowStyles: { fillColor: false },

  bodyStyles: {
    fillColor: false,        // ← transparent, watermark shows through
    textColor: [0, 0, 0],   // ← force black text
    lineColor: [200, 200, 200],
    lineWidth: 0.3,
  },

  columnStyles: {
    0: { cellWidth: 12,     halign: 'center' },
    1: { cellWidth: 'auto' },
    2: { cellWidth: 18,     halign: 'center' },
    3: { cellWidth: 32,     halign: 'right' },
    4: { cellWidth: 35,     halign: 'right' },
  },
});

  const finalY = (doc as any).lastAutoTable.finalY as number;

  // ── 8. TOTALS ─────────────────────────────────────────────────────────────
  const subtotal = Number(quotation.subtotal);
  const totalTax = Number(quotation.tax_amount);
  const totalAmt = Number(quotation.total_amount);
  const discount = Number(quotation.discount_amount) || 0;
  const hasTax   = totalTax > 0;

  const labelX = pageWidth - margin - 70;
  let totalsY  = finalY + 7;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  if (hasTax) {
    const halfTax  = totalTax / 2;
    const halfRate = subtotal > 0 ? (halfTax / subtotal) * 100 : 0;

    doc.setFont('helvetica', 'normal');
    doc.text('Sub-Total:', labelX, totalsY);
    doc.text(formatAmount(subtotal), pageWidth - margin, totalsY, { align: 'right' });
    totalsY += 5.5;

    doc.text(`SGST @ ${halfRate.toFixed(1)}%:`, labelX, totalsY);
    doc.text(formatAmount(halfTax), pageWidth - margin, totalsY, { align: 'right' });
    totalsY += 5.5;

    doc.text(`CGST @ ${halfRate.toFixed(1)}%:`, labelX, totalsY);
    doc.text(formatAmount(halfTax), pageWidth - margin, totalsY, { align: 'right' });
    totalsY += 5.5;
  }

  if (discount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('Discount:', labelX, totalsY);
    doc.text(`-${formatAmount(discount)}`, pageWidth - margin, totalsY, { align: 'right' });
    totalsY += 5.5;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(labelX, totalsY, pageWidth - margin, totalsY);
  totalsY += 4;

  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('Total:', labelX, totalsY);
  doc.text(formatAmount(totalAmt), pageWidth - margin, totalsY, { align: 'right' });
  totalsY += 8;

  // ── 9. TERMS & CONDITIONS ─────────────────────────────────────────────────
  let termsY = totalsY + 8;

  if (quotation.notes || quotation.terms) {
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Terms & Conditions:', margin, termsY);
    termsY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);

    if (quotation.notes) {
      const lines = doc.splitTextToSize(quotation.notes, pageWidth - margin * 2) as string[];
      doc.text(lines, margin, termsY);
      termsY += lines.length * 4.8 + 2;
    }

    if (quotation.terms) {
      const lines = doc.splitTextToSize(quotation.terms, pageWidth - margin * 2) as string[];
      doc.text(lines, margin, termsY);
      termsY += lines.length * 4.8;
    }
  }

  // ── 10. FOOTER ────────────────────────────────────────────────────────────
  const footerY = Math.max(termsY + 12, pageHeight - 28);

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Thanking you,', margin, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(businessName, margin, footerY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Authorised Signatory', pageWidth - margin, footerY + 6, { align: 'right' });

  return doc;
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export async function downloadQuotationPDF(params: GenerateQuotationPDFParams): Promise<void> {
  const doc = await generateQuotationPDF(params);
  doc.save(`${params.quotation.quotation_number}.pdf`);
}

export async function getQuotationPDFBlob(params: GenerateQuotationPDFParams): Promise<Blob> {
  const doc = await generateQuotationPDF(params);
  return doc.output('blob');
}

export async function getQuotationPDFDataUri(params: GenerateQuotationPDFParams): Promise<string> {
  const doc = await generateQuotationPDF(params);
  return doc.output('datauristring');
}
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Invoice, InvoiceItem, Business } from '@/types/database';
import {
  DEFAULT_INVOICE_TERMS,
  DEFAULT_INVOICE_WARRANTY,
  DEFAULT_SIGNATORY_NAME,
  DEFAULT_SIGNATORY_ROLE,
  DEFAULT_SIGNATURE_TEXT,
  generatePaymentQRCode,
  formatCurrency,
} from './invoiceTemplateConstants';

interface GenerateInvoicePDFParams {
  invoice: Invoice & { items?: InvoiceItem[] };
  business: Business | null;
}

export async function generateInvoicePDF({
  invoice,
  business,
}: GenerateInvoicePDFParams): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const currency = business?.currency || 'INR';
  const businessName = (business?.business_name || 'MOHAN ELECTRONICS').toUpperCase();
  const address = business?.business_address
    ? `${business.business_address}${business.city ? `, ${business.city}` : ''}${business.pincode ? `, ${business.pincode}` : ''}`
    : '1024 ASHOCK CHOWK, SOLAPUR, 413006';
  const gstin = business?.gstin || '112VJH3242JHJ23';
  const phone = business?.phone_number || '9370426583';
  const email = business?.email || 'mohanelec@gmail.com';

  const clientName = (invoice.client_name || 'KETUT SUSILO').toUpperCase();
  const clientAddress = invoice.client_address || '123 Anywhere St., Any City, ST 12345';
  const clientGstin = invoice.client_gstin || '112VJH3242JHJ23';

  const invoiceNumber = invoice.invoice_number || '12345';
  const invoiceDateFormatted = invoice.invoice_date
    ? format(new Date(invoice.invoice_date), 'dd MMMM yyyy')
    : format(new Date(), 'dd MMMM yyyy');

  let yPos = 14;

  // ── 1. HEADER ─────────────────────────────────────────────────────────────
  // Left side: Logo & Title
  if (business?.logo_url) {
    try {
      const response = await fetch(business.logo_url);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      doc.addImage(base64, 'AUTO', margin, yPos, 24, 24);
    } catch {
      drawDefaultLogo(doc, margin, yPos);
    }
  } else {
    drawDefaultLogo(doc, margin, yPos);
  }

  // Left side: Dark grey accent bar + INVOICE title
  const barY = yPos + 22;
  doc.setFillColor(74, 74, 74);
  doc.rect(margin, barY, 12, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(17, 24, 39);
  doc.text('INVOICE', margin + 15, barY + 5.2);

  // Right side: Company Information
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(55, 65, 81);

  const nameParts = businessName.split(' ');
  if (nameParts.length >= 2) {
    doc.text(nameParts[0], pageWidth - margin, yPos + 6, { align: 'right' });
    doc.text(nameParts.slice(1).join(' '), pageWidth - margin, yPos + 13, { align: 'right' });
  } else {
    doc.text(businessName, pageWidth - margin, yPos + 8, { align: 'right' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);
  doc.text(`Add. : ${address}`, pageWidth - margin, yPos + 18.5, { align: 'right' });
  doc.text(`GST No : ${gstin}`, pageWidth - margin, yPos + 22.5, { align: 'right' });

  // Contact line with phone & email
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`Phone: ${phone}   |   Email: ${email}`, pageWidth - margin, yPos + 27, { align: 'right' });

  yPos += 37;

  // ── 2. BILL TO & METADATA ────────────────────────────────────────────────
  // Left: Bill To
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('To', margin, yPos);

  yPos += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(clientName, margin, yPos);

  yPos += 4.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  doc.text(clientAddress, margin, yPos);

  if (clientGstin) {
    yPos += 4;
    doc.text(`GST No : ${clientGstin}`, margin, yPos);
  }

  // Right: Invoice Meta
  const metaRightX = pageWidth - margin;
  const metaLabelX = pageWidth - margin - 35;
  const metaY = yPos - 8.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('Invoice no :', metaLabelX, metaY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(invoiceNumber, metaRightX, metaY, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Date :', metaLabelX, metaY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(invoiceDateFormatted, metaRightX, metaY + 5.5, { align: 'right' });

  yPos += 8;

  // ── 3. ITEMS TABLE ───────────────────────────────────────────────────────
  const rawItems = invoice.items && invoice.items.length > 0 ? invoice.items : [
    { name: 'Consultation', description: '', quantity: 1, unit_price: 300, total: 300 },
    { name: 'Project Draft', description: '', quantity: 1, unit_price: 2400, total: 2400 },
    { name: 'Implementation', description: '', quantity: 1, unit_price: 2500, total: 2500 },
    { name: 'Additional Supplies', description: '', quantity: 1, unit_price: 750, total: 750 },
    { name: 'Monthly meeting', description: '', quantity: 1, unit_price: 2000, total: 2000 },
  ];

  const subtotal = Number(invoice.subtotal) || rawItems.reduce((acc, it) => acc + (Number(it.quantity) * Number(it.unit_price)), 0);
  const taxAmount = Number(invoice.tax_amount) || 0;
  const discountAmount = Number(invoice.discount_amount) || 0;
  const grandTotal = Number(invoice.total_amount) || (subtotal + taxAmount - discountAmount);

  let taxPercent = 0;
  if (subtotal > 0 && taxAmount > 0) {
    taxPercent = Math.round((taxAmount / subtotal) * 100);
  } else if (invoice.items?.[0]?.tax_rate) {
    taxPercent = Number(invoice.items[0].tax_rate);
  } else if (business?.default_tax_rate && taxAmount > 0) {
    taxPercent = Number(business.default_tax_rate);
  }

  const tableBody = rawItems.map((item, index) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unit_price) || 0;
    const lineTotal = Number((item as any).total) || (qty * price);
    const displayText = item.name + (item.description ? `\n${item.description}` : '');

    return [
      String(index + 1),
      displayText,
      String(qty),
      formatCurrency(price, currency),
      formatCurrency(lineTotal, currency),
    ];
  });

  // Solid top border rule above table
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  autoTable(doc, {
    startY: yPos,
    head: [['NO', 'DESCRIPTION', 'QTY', 'PRICE', 'TOTAL']],
    body: tableBody,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 2, right: 2 },
      textColor: [17, 24, 39],
      overflow: 'linebreak',
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 9,
      textColor: [17, 24, 39],
      fillColor: false,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'left' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 32, halign: 'right' },
    },
    didDrawCell: (data) => {
      // Draw dotted separator line under body rows except the last one
      if (data.section === 'body' && data.row.index < tableBody.length - 1 && data.column.index === 4) {
        const rowY = data.cell.y + data.cell.height;
        doc.saveGraphicsState();
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.2);
        doc.setLineDashPattern([0.8, 1.2], 0);
        doc.line(margin, rowY, pageWidth - margin, rowY);
        doc.restoreGraphicsState();
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY as number;

  // Solid bottom border rule under table
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.5);
  doc.line(margin, finalY, pageWidth - margin, finalY);

  // ── 4. SCAN TO PAY & TOTALS ──────────────────────────────────────────────
  const belowTableY = finalY + 7;

  // Left: SCAN TO PAY
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('SCAN TO PAY', margin, belowTableY);

  // QR Code
  const upiPayString = `upi://pay?pa=${phone}@upi&pn=${encodeURIComponent(businessName)}&am=${grandTotal}&cu=INR`;
  const qrDataUrl = await generatePaymentQRCode(upiPayString);
  doc.addImage(qrDataUrl, 'PNG', margin, belowTableY + 2.5, 26, 26);

  // Right: Summary lines
  const sumLabelX = pageWidth - margin - 65;
  const sumValX = pageWidth - margin;
  let sumY = belowTableY + 1;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('Sub Total', sumLabelX, sumY);
  doc.text(formatCurrency(subtotal, currency), sumValX, sumY, { align: 'right' });

  if (taxPercent > 0) {
    sumY += 5.5;
    doc.text(`Tax ${taxPercent}%`, sumLabelX, sumY);
    doc.text(formatCurrency(taxAmount, currency), sumValX, sumY, { align: 'right' });
  }

  if (discountAmount > 0) {
    sumY += 5.5;
    doc.text('Discount', sumLabelX, sumY);
    doc.text(`-${formatCurrency(discountAmount, currency)}`, sumValX, sumY, { align: 'right' });
  }

  // GRAND TOTAL Block
  const blockY = sumY + 6;
  const blockW = 75;
  const blockH = 9;
  const blockX = pageWidth - margin - blockW;

  doc.setFillColor(74, 74, 74);
  doc.rect(blockX, blockY, blockW, blockH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL', blockX + 4, blockY + 6);
  doc.text(formatCurrency(grandTotal, currency), blockX + blockW - 4, blockY + 6, { align: 'right' });

  // ── 5. TERMS, WARRANTY & SIGNATURE ───────────────────────────────────────
  const termsY = Math.max(belowTableY + 33, blockY + 16);

  const termsText = invoice.terms || business?.default_terms || DEFAULT_INVOICE_TERMS;
  const warrantyText = invoice.notes || business?.default_notes || DEFAULT_INVOICE_WARRANTY;

  // Left column: Terms & Warranty
  const leftColWidth = 110;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('Term and Conditions :', margin, termsY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  const termLines = doc.splitTextToSize(termsText, leftColWidth) as string[];
  doc.text(termLines, margin, termsY + 4);

  const warrantyY = termsY + 5 + termLines.length * 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('Warranty and Disclaimers :', margin, warrantyY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  const warrantyLines = doc.splitTextToSize(warrantyText, leftColWidth) as string[];
  doc.text(warrantyLines, margin, warrantyY + 4);

  // Right column: Cursive signature, Name & Properator
  const sigX = pageWidth - margin - 22;
  const sigY = termsY + 6;

  // Cursive signature (Adeline Palmerston)
  doc.setFont('times', 'italic');
  doc.setFontSize(16);
  doc.setTextColor(100, 100, 100);
  doc.text(DEFAULT_SIGNATURE_TEXT, sigX, sigY, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text(DEFAULT_SIGNATORY_NAME, sigX, sigY + 6, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(59, 130, 246); // Blue color for designation
  doc.text(DEFAULT_SIGNATORY_ROLE, sigX, sigY + 10.5, { align: 'center' });

  // ── 6. FOOTER ────────────────────────────────────────────────────────────
  const footerY = pageHeight - 16;

  // Separator line
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  // Electronics icon text / vector representations on left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(55, 65, 81);
  doc.text('[CCTV]   [DISH]   [AUDIO]   [TV]   [WI-FI]', margin, footerY + 2);

  // Blue cursive script on right
  doc.setFont('times', 'italic');
  doc.setFontSize(13);
  doc.setTextColor(59, 130, 246);
  doc.text('Thank You for your Purchase !', pageWidth - margin, footerY + 2, { align: 'right' });

  return doc;
}

/**
 * Draws the Mohan Electronics stylized swoosh & ME logo in vector graphics
 */
function drawDefaultLogo(doc: jsPDF, x: number, y: number) {
  doc.saveGraphicsState();
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(1.2);

  // Outer swoosh curve
  doc.ellipse(x + 12, y + 10, 14, 7, 'S');

  // Center "ME" letters
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text('ME', x + 5, y + 13);
  doc.restoreGraphicsState();
}

export async function downloadInvoicePDF(params: GenerateInvoicePDFParams): Promise<void> {
  const doc = await generateInvoicePDF(params);
  doc.save(`${params.invoice.invoice_number}.pdf`);
}

export async function getInvoicePDFBlob(params: GenerateInvoicePDFParams): Promise<Blob> {
  const doc = await generateInvoicePDF(params);
  return doc.output('blob');
}

export async function getInvoicePDFDataUri(params: GenerateInvoicePDFParams): Promise<string> {
  const doc = await generateInvoicePDF(params);
  return doc.output('datauristring');
}
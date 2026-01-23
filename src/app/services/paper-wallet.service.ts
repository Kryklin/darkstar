import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';

export interface PaperWalletMetadata {
  protocolTitle: string;
  protocolSummary: string;
  noiseLevel?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PaperWalletService {
  /**
   * Generates and downloads a PDF paper wallet.
   * @param encryptedData The main encrypted payload.
   * @param reverseKey The reverse compression key.
   * @param metadata Protocol metadata for the header.
   */
  async generate(encryptedData: string, reverseKey: string, metadata: PaperWalletMetadata): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 0;

    const addHeader = () => {
      doc.setFillColor(33, 33, 33); // Dark background
      doc.rect(0, 0, pageWidth, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text('Darkstar Paper Wallet', margin, 20);

      doc.setFontSize(12);
      doc.setTextColor(200, 200, 200);
      doc.text(`Protocol: ${metadata.protocolTitle}`, margin, 32);

      doc.setFontSize(10);
      doc.text(new Date().toLocaleString(), pageWidth - margin, 20, { align: 'right' });
      
      // Reset for content
      doc.setTextColor(0, 0, 0);
      y = 60;
    };

    addHeader();

    const writeSection = (title: string, content: string, font: 'courier' | 'helvetica' = 'courier') => {
      // Section Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      
      // Check if title fits, else new page
      if (y + 10 > pageHeight - margin) {
        doc.addPage();
        addHeader();
      }
      doc.text(title, margin, y);
      y += 10;

      // Section Content
      doc.setFontSize(10);
      doc.setFont(font, 'normal');
      
      const splitText = doc.splitTextToSize(content, contentWidth);
      const lineHeight = 5;

      for (const line of splitText) {
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage();
          addHeader();
          // Re-print section title context if split? Maybe overkill, just continue.
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }
      
      y += 10; // Spacing after section
    };

    // 1. Encrypted Data
    writeSection('1. Encrypted Data', encryptedData);

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // 2. Reverse Key
    writeSection('2. Reverse Key', reverseKey);

    // --- Footer / Instructions ---
    if (y + 40 > pageHeight - margin) {
      doc.addPage();
      addHeader();
    }
    
    y += 10;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    const instructions = [
      'IMPORTANT RECOVERY INSTRUCTIONS:',
      '1. This document contains your encrypted backup.',
      "2. To recover, you will need BOTH the 'Encrypted Data' and the 'Reverse Key'.",
      '3. You must also remember your Encryption Password. It is NOT printed here.',
      '4. Keep this document in a physically secure location (e.g., fireproof safe).',
      '5. Do not share this document.',
    ];

    for (const line of instructions) {
       if (y + 5 > pageHeight - margin) {
          doc.addPage();
          addHeader();
       }
       doc.text(line, margin, y);
       y += 5;
    }

    // Save
    doc.save(`darkstar-paper-wallet-${Date.now()}.pdf`);
  }
}

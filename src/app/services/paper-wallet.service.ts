import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';

export interface PaperWalletMetadata {
  protocolTitle: string;
  protocolSummary: string;
  noiseLevel?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaperWalletService {

  constructor() { }

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

    // --- Header ---
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

    // --- Content Setup ---
    let y = 60;
    doc.setTextColor(0, 0, 0); // Reset text color to black

    // --- Encrypted Data Section ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Encrypted Data', margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('courier', 'normal');
    const splitData = doc.splitTextToSize(encryptedData, pageWidth - (margin * 2));
    doc.text(splitData, margin, y);
    
    // Calculate new Y based on text lines
    y += (splitData.length * 5) + 10;

    // --- Divider ---
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 20;

    // --- Reverse Key Section ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Reverse Key', margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('courier', 'normal');
    const splitKey = doc.splitTextToSize(reverseKey, pageWidth - (margin * 2));
    doc.text(splitKey, margin, y);

     y += (splitKey.length * 5) + 20;

    // --- Footer / Instructions ---
    // If getting close to bottom, add a new page? logic for simple text:
    if (y > pageHeight - 50) {
        doc.addPage();
        y = 40;
    }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    
    const instructions = [
        "IMPORTANT RECOVERY INSTRUCTIONS:",
        "1. This document contains your encrypted backup.",
        "2. To recover, you will need BOTH the 'Encrypted Data' and the 'Reverse Key'.",
        "3. You must also remember your Encryption Password. It is NOT printed here.",
        "4. Keep this document in a physically secure location (e.g., fireproof safe).",
        "5. Do not share this document."
    ];
    
    doc.text(instructions, margin, y);
    
    // Save
    doc.save(`darkstar-paper-wallet-${Date.now()}.pdf`);
  }
}

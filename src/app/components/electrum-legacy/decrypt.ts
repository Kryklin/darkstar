import { Component } from '@angular/core';
import { SharedDecryptComponent } from '../shared/decrypt/decrypt';
import ElectrumLegacy from '../../../assets/electrum-legacy.json';

@Component({
  selector: 'app-electrum-legacy-decrypt',
  standalone: true,
  imports: [SharedDecryptComponent],
  template: `
    <app-shared-decrypt
      [protocolTitle]="protocolTitle"
      [protocolSummary]="protocolSummary"
      [protocolLink]="protocolLink"
    ></app-shared-decrypt>
  `,
})
export class ElectrumLegacyDecrypt {
  protocolTitle = ElectrumLegacy.title;
  protocolSummary = ElectrumLegacy.summary;
  protocolLink = ElectrumLegacy.link;
}

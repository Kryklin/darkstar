import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ElectrumLegacyDecrypt } from './decrypt';
import { MaterialModule } from '../../modules/material/material';

describe('ElectrumLegacyDecrypt', () => {
  let component: ElectrumLegacyDecrypt;
  let fixture: ComponentFixture<ElectrumLegacyDecrypt>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ElectrumLegacyDecrypt, BrowserAnimationsModule, MaterialModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ElectrumLegacyDecrypt);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

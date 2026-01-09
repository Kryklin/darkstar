import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ElectrumLegacyEncrypt } from './encrypt';
import { MaterialModule } from '../../modules/material/material';

describe('ElectrumLegacyEncrypt', () => {
  let component: ElectrumLegacyEncrypt;
  let fixture: ComponentFixture<ElectrumLegacyEncrypt>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ElectrumLegacyEncrypt, BrowserAnimationsModule, MaterialModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ElectrumLegacyEncrypt);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

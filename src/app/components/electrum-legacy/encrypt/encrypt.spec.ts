import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElectrumLegacyEncrypt } from './encrypt';
import { MaterialModule } from '../../../modules/material/material';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CryptService } from '../../../services/crypt';

describe('ElectrumLegacyEncrypt', () => {
  let component: ElectrumLegacyEncrypt;
  let fixture: ComponentFixture<ElectrumLegacyEncrypt>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ElectrumLegacyEncrypt, MaterialModule, NoopAnimationsModule],
      providers: [CryptService],
    }).compileComponents();

    fixture = TestBed.createComponent(ElectrumLegacyEncrypt);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize forms', () => {
    expect(component.firstFormGroup).toBeDefined();
    expect(component.secondFormGroup).toBeDefined();
  });

  it('should generate random words', () => {
    component.generateRandomWords();
    const value = component.firstFormGroup.controls['firstCtrl'].value;
    expect(value).toBeTruthy();
    expect(value.split(' ').length).toBeGreaterThan(0);
  });
});

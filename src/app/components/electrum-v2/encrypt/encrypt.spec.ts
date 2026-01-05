import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElectrumV2Encrypt } from './encrypt';
import { MaterialModule } from '../../../modules/material/material';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CryptService } from '../../../services/crypt';

describe('ElectrumV2Encrypt', () => {
  let component: ElectrumV2Encrypt;
  let fixture: ComponentFixture<ElectrumV2Encrypt>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ElectrumV2Encrypt, MaterialModule, NoopAnimationsModule],
      providers: [CryptService],
    }).compileComponents();

    fixture = TestBed.createComponent(ElectrumV2Encrypt);
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

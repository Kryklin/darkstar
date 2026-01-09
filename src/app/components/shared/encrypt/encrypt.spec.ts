import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { SharedEncryptComponent } from './encrypt';
import { CryptService } from '../../../services/crypt';
import { SteganographyService } from '../../../services/steganography.service';
import { PaperWalletService } from '../../../services/paper-wallet.service';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MaterialModule } from '../../../modules/material/material';

describe('SharedEncryptComponent', () => {
  let component: SharedEncryptComponent;
  let fixture: ComponentFixture<SharedEncryptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedEncryptComponent, BrowserAnimationsModule, MaterialModule, MatSnackBarModule],
      providers: [
        CryptService,
        SteganographyService,
        PaperWalletService
      ], 
    }).compileComponents();

    fixture = TestBed.createComponent(SharedEncryptComponent);
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
});

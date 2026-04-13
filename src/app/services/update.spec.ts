import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { UpdateService } from './update';

describe('UpdateService', () => {
  let service: UpdateService;

  beforeEach(() => {
    // Mock Electron API
    (window as any).electronAPI = {
      setVersionLock: jasmine.createSpy('setVersionLock'),
      onUpdateStatus: jasmine.createSpy('onUpdateStatus'),
      onInitiateUpdateCheck: jasmine.createSpy('onInitiateUpdateCheck'),
      restartAndInstall: jasmine.createSpy('restartAndInstall'),
    };

    TestBed.configureTestingModule({
      imports: [MatSnackBarModule],
      providers: [provideRouter([]), UpdateService],
    });
    service = TestBed.inject(UpdateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set up listeners if running in electron', () => {
    expect((window as any).electronAPI.onUpdateStatus).toHaveBeenCalled();
    expect((window as any).electronAPI.onInitiateUpdateCheck).toHaveBeenCalled();
  });

  it('should toggle version lock', () => {
    const initialLock = service.versionLocked();
    service.toggleVersionLock();
    expect(service.versionLocked()).toBe(!initialLock);
    expect((window as any).electronAPI.setVersionLock).toHaveBeenCalledWith(!initialLock);
  });
});

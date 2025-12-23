import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { UpdateService } from './update';

describe('UpdateService', () => {
  let service: UpdateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), UpdateService],
    });
    service = TestBed.inject(UpdateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

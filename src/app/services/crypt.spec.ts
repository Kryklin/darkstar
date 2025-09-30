import { TestBed } from '@angular/core/testing';

import { Crypt } from './crypt';

describe('Crypt', () => {
  let service: Crypt;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Crypt);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

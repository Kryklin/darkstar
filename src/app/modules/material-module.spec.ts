import { TestBed } from '@angular/core/testing';
import { MaterialModule } from './material-module';

describe('MaterialModule', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MaterialModule]
    });
  });

  it('should be created', () => {
    const module = TestBed.inject(MaterialModule);
    expect(module).toBeTruthy();
  });
});

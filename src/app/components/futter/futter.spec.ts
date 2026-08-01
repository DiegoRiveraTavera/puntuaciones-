import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Futter } from './futter';

describe('Futter', () => {
  let component: Futter;
  let fixture: ComponentFixture<Futter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Futter]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Futter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

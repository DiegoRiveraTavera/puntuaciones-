import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tecnica } from './tecnica';

describe('Tecnica', () => {
  let component: Tecnica;
  let fixture: ComponentFixture<Tecnica>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tecnica]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Tecnica);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

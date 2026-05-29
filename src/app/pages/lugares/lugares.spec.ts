import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Lugares } from './lugares';

describe('Lugares', () => {
  let component: Lugares;
  let fixture: ComponentFixture<Lugares>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Lugares]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Lugares);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

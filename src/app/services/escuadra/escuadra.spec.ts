import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Escuadra } from './escuadra';

describe('Escuadra', () => {
  let component: Escuadra;
  let fixture: ComponentFixture<Escuadra>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Escuadra]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Escuadra);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

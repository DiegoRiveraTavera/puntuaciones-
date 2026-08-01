import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Wearable } from './wearable';

describe('Wearable', () => {
  let component: Wearable;
  let fixture: ComponentFixture<Wearable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Wearable]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Wearable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

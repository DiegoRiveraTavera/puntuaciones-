import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WearableWidget } from './wearable-widget';

describe('WearableWidget', () => {
  let component: WearableWidget;
  let fixture: ComponentFixture<WearableWidget>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WearableWidget]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WearableWidget);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});


import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('displays checking before the API responds', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .toContain('Checking...');

    httpMock.expectOne('/api/health').flush({
      status: 'Healthy',
    });
  });

  it('displays connected when the API is healthy', () => {
    const fixture = TestBed.createComponent(Dashboard);

    const request = httpMock.expectOne('/api/health');
    request.flush({ status: 'Healthy' });

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .toContain('Connected');
  });

  it('displays unavailable when the API request fails', () => {
    const fixture = TestBed.createComponent(Dashboard);

    const request = httpMock.expectOne('/api/health');

    request.flush(
      { title: 'Service Unavailable' },
      {
        status: 503,
        statusText: 'Service Unavailable',
      },
    );

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .toContain('Unavailable');
  });
});

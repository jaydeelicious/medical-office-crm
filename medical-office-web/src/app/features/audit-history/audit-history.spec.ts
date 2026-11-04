
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuditHistory } from './audit-history';
import { AuditLogService } from './audit-log.service';
import {
    AuditLog,
    AuditLogFilters,
    PagedResult,
} from './audit-log.model';

describe('AuditHistory', () => {
    let fixture: ComponentFixture<AuditHistory>;
    let component: AuditHistory;

    const auditLog: AuditLog = {
        id: '11111111-1111-1111-1111-111111111111',
        occurredAtUtc: '2026-11-03T10:30:00Z',
        entityType: 'Patient',
        entityId: '22222222-2222-2222-2222-222222222222',
        action: 'Updated',
        userId: 'test-user-id',
    };

    const createdLog: AuditLog = {
        ...auditLog,
        id: '33333333-3333-3333-3333-333333333333',
        action: 'Created',
    };

    const deletedLog: AuditLog = {
        ...auditLog,
        id: '44444444-4444-4444-4444-444444444444',
        entityType: 'Doctor',
        action: 'Deleted',
        userId: null,
    };

    const createPage = (
        items: AuditLog[] = [auditLog],
        page = 1,
        totalCount = items.length,
    ): PagedResult<AuditLog> => ({
        items,
        page,
        pageSize: 20,
        totalCount,
    });

    const auditServiceMock = {
        getPaged: vi.fn(),
    };

    beforeEach(async () => {
        auditServiceMock.getPaged.mockReset();

        await TestBed.configureTestingModule({
            imports: [AuditHistory],
            providers: [
                {
                    provide: AuditLogService,
                    useValue: auditServiceMock,
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AuditHistory);
        component = fixture.componentInstance;
    });

    function render(): void {
        fixture.detectChanges();
    }

    function pageText(): string {
        return fixture.nativeElement.textContent as string;
    }

    it('loads the first page with the default page size', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage()),
        );

        render();

        expect(auditServiceMock.getPaged).toHaveBeenCalledOnce();
        expect(auditServiceMock.getPaged).toHaveBeenCalledWith({
            page: 1,
            pageSize: 20,
        });

        expect(component.logs()).toEqual([auditLog]);
        expect(component.totalCount()).toBe(1);
        expect(component.isLoading()).toBe(false);
    });

    it('displays the loading indicator during an API request', () => {
        const response = new Subject<PagedResult<AuditLog>>();

        auditServiceMock.getPaged.mockReturnValue(
            response.asObservable(),
        );

        render();

        expect(component.isLoading()).toBe(true);

        expect(
            fixture.nativeElement.querySelector(
                'app-loading-indicator',
            ),
        ).not.toBeNull();

        expect(pageText()).toContain(
            'Loading audit history...',
        );

        response.next(createPage());
        response.complete();

        render();

        expect(component.isLoading()).toBe(false);
        expect(component.logs()).toEqual([auditLog]);
    });

    it('displays an empty state when there are no events', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage([])),
        );

        render();

        expect(component.logs()).toEqual([]);

        expect(
            fixture.nativeElement.querySelector('app-empty-state'),
        ).not.toBeNull();

        expect(pageText()).toContain(
            'No audit events found',
        );
    });

    it('renders audit events and their action badges', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage([
                auditLog,
                createdLog,
                deletedLog,
            ])),
        );

        render();

        const rows = fixture.nativeElement.querySelectorAll(
            'tbody tr',
        ) as NodeListOf<HTMLTableRowElement>;

        expect(rows.length).toBe(3);

        expect(pageText()).toContain('Patient');
        expect(pageText()).toContain('Doctor');
        expect(pageText()).toContain('Updated');
        expect(pageText()).toContain('Created');
        expect(pageText()).toContain('Deleted');

        expect(
            fixture.nativeElement.querySelector(
                '.action-updated',
            ),
        ).not.toBeNull();

        expect(
            fixture.nativeElement.querySelector(
                '.action-created',
            ),
        ).not.toBeNull();

        expect(
            fixture.nativeElement.querySelector(
                '.action-deleted',
            ),
        ).not.toBeNull();

        expect(pageText()).toContain('test-user-id');
        expect(pageText()).toContain('System');
    });

    it('displays an error and allows retry after server failure', () => {
        auditServiceMock.getPaged
            .mockReturnValueOnce(
                throwError(
                    () => new HttpErrorResponse({ status: 500 }),
                ),
            )
            .mockReturnValueOnce(
                of(createPage()),
            );

        render();

        expect(component.canRetry()).toBe(true);
        expect(component.errorMessage()).toContain(
            'Unable to load audit history',
        );

        expect(
            fixture.nativeElement.querySelector(
                'app-error-message',
            ),
        ).not.toBeNull();

        const retryButton = fixture.nativeElement.querySelector(
            'app-error-message button',
        ) as HTMLButtonElement;

        expect(retryButton).not.toBeNull();

        retryButton.click();
        render();

        expect(auditServiceMock.getPaged).toHaveBeenCalledTimes(2);
        expect(component.logs()).toEqual([auditLog]);
        expect(component.errorMessage()).toBeNull();
    });

    it.each([
        [401, 'Your session has expired.'],
        [403, 'Administrator access is required'],
    ])(
        'displays a non-retryable error for HTTP %i',
        (status, expectedMessage) => {
            auditServiceMock.getPaged.mockReturnValue(
                throwError(
                    () => new HttpErrorResponse({ status }),
                ),
            );

            render();

            expect(component.canRetry()).toBe(false);
            expect(pageText()).toContain(expectedMessage);

            expect(
                fixture.nativeElement.querySelector(
                    'app-error-message button',
                ),
            ).toBeNull();
        },
    );

    it('does not request new data until filters are applied', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage()),
        );

        render();

        component.entityType.set('Patient');
        component.action.set('Updated');
        component.userId.set('test-user-id');

        expect(auditServiceMock.getPaged).toHaveBeenCalledOnce();
        expect(component.appliedFilters()).toEqual({});
    });

    it('applies combined filters and resets pagination', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage()),
        );

        render();

        component.page.set(3);

        component.entityType.set('Patient');
        component.action.set('Updated');
        component.entityId.set(`  ${auditLog.entityId}  `);
        component.userId.set('  test-user-id  ');

        component.applyFilters();

        const expectedFilters: AuditLogFilters = {
            entityType: 'Patient',
            action: 'Updated',
            entityId: auditLog.entityId,
            userId: 'test-user-id',
        };

        expect(component.page()).toBe(1);
        expect(component.appliedFilters()).toEqual(expectedFilters);

        expect(auditServiceMock.getPaged).toHaveBeenLastCalledWith({
            ...expectedFilters,
            page: 1,
            pageSize: 20,
        });
    });

    it('converts selected local date boundaries to UTC', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage()),
        );

        render();

        component.fromDate.set('2026-11-01');
        component.toDate.set('2026-11-03');

        component.applyFilters();

        expect(component.appliedFilters().fromUtc).toBe(
            new Date('2026-11-01T00:00:00').toISOString(),
        );

        expect(component.appliedFilters().toUtc).toBe(
            new Date('2026-11-03T23:59:59.999').toISOString(),
        );
    });

    it('clears all filters and reloads page one', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage()),
        );

        render();

        component.entityType.set('Patient');
        component.action.set('Updated');
        component.entityId.set(auditLog.entityId);
        component.userId.set('test-user-id');
        component.fromDate.set('2026-11-01');
        component.toDate.set('2026-11-03');

        component.applyFilters();

        component.page.set(2);
        component.clearFilters();

        expect(component.entityType()).toBe('');
        expect(component.action()).toBe('');
        expect(component.entityId()).toBe('');
        expect(component.userId()).toBe('');
        expect(component.fromDate()).toBe('');
        expect(component.toDate()).toBe('');

        expect(component.appliedFilters()).toEqual({});
        expect(component.page()).toBe(1);

        expect(auditServiceMock.getPaged).toHaveBeenLastCalledWith({
            page: 1,
            pageSize: 20,
        });
    });

    it('navigates between pages while preserving filters', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage([auditLog], 1, 45)),
        );

        render();

        component.entityType.set('Patient');
        component.applyFilters();

        expect(component.totalPages()).toBe(3);
        expect(component.hasPreviousPage()).toBe(false);
        expect(component.hasNextPage()).toBe(true);

        component.nextPage();

        expect(component.page()).toBe(2);

        expect(auditServiceMock.getPaged).toHaveBeenLastCalledWith({
            entityType: 'Patient',
            page: 2,
            pageSize: 20,
        });

        component.previousPage();

        expect(component.page()).toBe(1);
    });

    it('does not navigate outside the available pages', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage([auditLog], 1, 1)),
        );

        render();

        component.previousPage();
        component.nextPage();

        expect(component.page()).toBe(1);
        expect(auditServiceMock.getPaged).toHaveBeenCalledOnce();
    });

    it('calculates the visible record range correctly', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage([auditLog], 1, 45)),
        );

        render();

        expect(component.resultStart()).toBe(1);
        expect(component.resultEnd()).toBe(20);

        component.page.set(3);

        expect(component.resultStart()).toBe(41);
        expect(component.resultEnd()).toBe(45);
    });

    it('cancels the previous request before loading new filters', () => {
        const firstResponse =
            new Subject<PagedResult<AuditLog>>();

        auditServiceMock.getPaged
            .mockReturnValueOnce(firstResponse.asObservable())
            .mockReturnValueOnce(
                of(createPage([createdLog])),
            );

        render();

        expect(firstResponse.observed).toBe(true);
        expect(component.isLoading()).toBe(true);

        component.action.set('Created');
        component.applyFilters();

        expect(firstResponse.observed).toBe(false);

        expect(component.logs()).toEqual([createdLog]);
        expect(component.isLoading()).toBe(false);

        expect(auditServiceMock.getPaged).toHaveBeenCalledTimes(2);
    });


    it('rejects an invalid entity ID without calling the API', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage()),
        );

        render();

        component.entityId.set('invalid-guid');
        component.applyFilters();

        expect(component.filterError()).toBe(
            'Entity ID must be a valid GUID.',
        );

        expect(auditServiceMock.getPaged).toHaveBeenCalledOnce();
    });

    it('rejects an inverted date range', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage()),
        );

        render();

        component.fromDate.set('2026-11-10');
        component.toDate.set('2026-11-01');

        component.applyFilters();

        expect(component.filterError()).toContain(
            'The From date cannot be later than the To date.',
        );

        expect(auditServiceMock.getPaged).toHaveBeenCalledOnce();
    });

    it('clears validation errors when filters are reset', () => {
        auditServiceMock.getPaged.mockReturnValue(
            of(createPage()),
        );

        render();

        component.entityId.set('invalid');
        component.applyFilters();

        expect(component.filterError()).not.toBeNull();

        component.clearFilters();

        expect(component.filterError()).toBeNull();
        expect(component.entityId()).toBe('');

        expect(auditServiceMock.getPaged).toHaveBeenCalledTimes(2);
    });
});

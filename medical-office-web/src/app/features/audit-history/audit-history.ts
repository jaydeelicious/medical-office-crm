
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
    Component,
    DestroyRef,
    OnInit,
    computed,
    inject,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import {
    AuditAction,
    AuditEntityType,
    AuditLog,
    AuditLogFilters,
    PagedResult,
} from './audit-log.model';
import { AuditLogService } from './audit-log.service';

import { LoadingIndicator } from
    '../../shared/components/loading-indicator/loading-indicator';
import { EmptyState } from
    '../../shared/components/empty-state/empty-state';
import { ErrorMessage } from
    '../../shared/components/error-message/error-message';

@Component({
    selector: 'app-audit-history',
    imports: [
        DatePipe,
        LoadingIndicator,
        EmptyState,
        ErrorMessage,
    ],
    templateUrl: './audit-history.html',
    styleUrl: './audit-history.scss',
})
export class AuditHistory implements OnInit {
    private readonly auditService = inject(AuditLogService);
    private readonly destroyRef = inject(DestroyRef);

    private request?: Subscription;

    readonly logs = signal<AuditLog[]>([]);
    readonly totalCount = signal(0);
    readonly page = signal(1);
    readonly pageSize = 20;

    readonly entityType = signal('');
    readonly action = signal('');
    readonly entityId = signal('');
    readonly userId = signal('');
    readonly fromDate = signal('');
    readonly toDate = signal('');

    readonly appliedFilters = signal<AuditLogFilters>({});

    readonly isLoading = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly canRetry = signal(false);

    readonly filterError = signal<string | null>(null);

    readonly totalPages = computed(() =>
        Math.ceil(this.totalCount() / this.pageSize),
    );

    readonly hasPreviousPage = computed(() =>
        this.page() > 1,
    );

    readonly hasNextPage = computed(() =>
        this.page() < this.totalPages(),
    );

    readonly resultStart = computed(() =>
        this.totalCount() === 0
            ? 0
            : (this.page() - 1) * this.pageSize + 1,
    );

    readonly resultEnd = computed(() =>
        Math.min(
            this.page() * this.pageSize,
            this.totalCount(),
        ),
    );

    ngOnInit(): void {
        this.loadAuditLogs();
    }

    loadAuditLogs(): void {
        this.request?.unsubscribe();

        this.isLoading.set(true);
        this.errorMessage.set(null);
        this.canRetry.set(false);

        this.request = this.auditService.getPaged({
            ...this.appliedFilters(),
            page: this.page(),
            pageSize: this.pageSize,
        })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (result: PagedResult<AuditLog>) => {
                    this.logs.set(result.items);
                    this.totalCount.set(result.totalCount);
                    this.isLoading.set(false);
                },
                error: (error: unknown) => {
                    this.logs.set([]);
                    this.totalCount.set(0);
                    this.errorMessage.set(
                        this.getErrorMessage(error),
                    );
                    this.canRetry.set(this.isRetryable(error));
                    this.isLoading.set(false);
                },
            });
    }

    applyFilters(): void {
        if (!this.validateFilters()) {
            return;
        }

        const filters: AuditLogFilters = {};

        if (this.entityType()) {
            filters.entityType =
                this.entityType() as AuditEntityType;
        }

        if (this.action()) {
            filters.action = this.action() as AuditAction;
        }

        if (this.entityId().trim()) {
            filters.entityId = this.entityId().trim();
        }

        if (this.userId().trim()) {
            filters.userId = this.userId().trim();
        }

        if (this.fromDate()) {
            filters.fromUtc =
                new Date(`${this.fromDate()}T00:00:00`).toISOString();
        }

        if (this.toDate()) {
            filters.toUtc =
                new Date(`${this.toDate()}T23:59:59.999`).toISOString();
        }

        this.appliedFilters.set(filters);
        this.page.set(1);
        this.loadAuditLogs();
    }

    clearFilters(): void {
        this.entityType.set('');
        this.action.set('');
        this.entityId.set('');
        this.userId.set('');
        this.fromDate.set('');
        this.toDate.set('');

        this.filterError.set(null);

        this.appliedFilters.set({});
        this.page.set(1);
        this.loadAuditLogs();
    }

    previousPage(): void {
        if (this.isLoading() || !this.hasPreviousPage()) {
            return;
        }

        this.page.update((value) => value - 1);
        this.loadAuditLogs();
    }

    nextPage(): void {
        if (this.isLoading() || !this.hasNextPage()) {
            return;
        }

        this.page.update((value) => value + 1);
        this.loadAuditLogs();
    }

    getActionClass(action: string): string {
        switch (action) {
            case 'Created': return 'action-created';
            case 'Updated': return 'action-updated';
            case 'Deleted': return 'action-deleted';
            default: return '';
        }
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof HttpErrorResponse) {
            switch (error.status) {
                case 400:
                    return 'Invalid audit filters. Please review your selections.';
                case 401:
                    return 'Your session has expired. Please sign in again.';
                case 403:
                    return 'Administrator access is required to view audit history.';
                case 0:
                    return 'Unable to connect to the server.';
                default:
                    return 'Unable to load audit history. Please try again.';
            }
        }

        return 'An unexpected error occurred.';
    }

    private isRetryable(error: unknown): boolean {
        return error instanceof HttpErrorResponse &&
            (error.status === 0 ||
                error.status === 408 ||
                error.status === 429 ||
                error.status >= 500);
    }

    private validateFilters(): boolean {
        this.filterError.set(null);

        const entityId = this.entityId().trim();

        if (entityId) {
            const guidPattern =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            if (!guidPattern.test(entityId)) {
                this.filterError.set(
                    'Entity ID must be a valid GUID.',
                );
                return false;
            }
        }

        const from = this.fromDate();
        const to = this.toDate();

        if (from && to && from > to) {
            this.filterError.set(
                'The From date cannot be later than the To date.',
            );
            return false;
        }

        return true;
    }

}

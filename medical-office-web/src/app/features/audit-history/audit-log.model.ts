export type AuditEntityType = 
    | 'Patient'
    | 'Doctor'
    | 'Appointment';

export type AuditAction = 
    | 'Created'
    | 'Updated'
    | 'Deleted';

export interface AuditLog {
    id: string;
    occurredAtUtc: string;
    entityType: AuditEntityType;
    entityId: string;
    action: AuditAction;
    userId: string | null;
}

export interface AuditLogFilters {
    entityType?: AuditEntityType;
    entityId?: string;
    action?: AuditAction;
    userId?: string;
    fromUtc?: string;
    toUtc?: string;
    page?: number;
    pageSize?: number;
}

export interface PagedResult<T> {
    items: T[];
    page: number;
    pageSize: number;
    totalCount: number;
}

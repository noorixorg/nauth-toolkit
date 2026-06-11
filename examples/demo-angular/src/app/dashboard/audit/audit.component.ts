import { Component, OnInit, signal, computed, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@nauth-toolkit/client-angular/standalone';
import {
  AuthAuditEvent,
  AuthAuditEventType,
  AuthAuditEventStatus,
  AuditHistoryResponse,
  NAuthClientError,
} from '@nauth-toolkit/client';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { MultiSelectModule } from 'primeng/multiselect';

/**
 * Audit Trail Component
 *
 * Displays authentication and security event history in a paginated table.
 * Supports filtering by date range and status, with detailed view in sidebar.
 *
 * @example
 * ```typescript
 * // Used within dashboard component
 * <app-audit />
 * ```
 */
@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    PaginatorModule,
    TagModule,
    ButtonModule,
    MessageModule,
    DatePickerModule,
    DrawerModule,
    MultiSelectModule,
  ],
  providers: [DatePipe],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.css',
})
export class AuditComponent implements OnInit {
  /**
   * Auth service for audit history
   */
  private readonly auth = inject(AuthService);

  /**
   * Change detector for manual change detection
   */
  private readonly cdr = inject(ChangeDetectorRef);

  /**
   * Date pipe for formatting
   */
  private readonly datePipe = new DatePipe('en-US');

  /**
   * Audit events data
   */
  events = signal<AuthAuditEvent[]>([]);

  /**
   * Total number of events
   */
  total = signal(0);

  /**
   * Current page (1-indexed)
   */
  page = signal(1);

  /**
   * Items per page
   */
  limit = signal(20);

  /**
   * Total pages
   */
  totalPages = signal(0);

  /**
   * Loading state
   */
  loading = signal(false);

  /**
   * Error message
   */
  error = signal<string | null>(null);

  /**
   * Selected event for detail view
   */
  selectedEvent = signal<AuthAuditEvent | null>(null);

  /**
   * Sidebar visibility
   */
  sidebarVisible = signal(false);

  /**
   * Drawer width based on viewport
   */
  drawerWidth = computed(() => {
    if (typeof window === 'undefined') return '100vw';
    const width = window.innerWidth;
    if (width < 768) return '100vw';
    if (width < 1024) return '35rem';
    if (width < 1280) return '40rem';
    return '42rem';
  });

  /**
   * Date range filter
   */
  dateRange = signal<Date[] | null>(null);

  /**
   * Status filter options
   */
  statusOptions = [
    { label: 'Success', value: 'SUCCESS' as AuthAuditEventStatus },
    { label: 'Failure', value: 'FAILURE' as AuthAuditEventStatus },
    { label: 'Info', value: 'INFO' as AuthAuditEventStatus },
    { label: 'Suspicious', value: 'SUSPICIOUS' as AuthAuditEventStatus },
  ];

  /**
   * Selected status filters (multiple)
   */
  selectedStatuses = signal<AuthAuditEventStatus[]>([]);

  /**
   * Computed pagination info
   */
  paginationInfo = computed(() => {
    const current = this.page();
    const total = this.totalPages();
    const start = (current - 1) * this.limit() + 1;
    const end = Math.min(current * this.limit(), this.total());
    return { start, end, total: this.total() };
  });

  /**
   * Component initialization
   */
  ngOnInit(): void {
    // Defer initial load to next tick to prevent ExpressionChangedAfterItHasBeenCheckedError
    // This ensures the view is fully initialized before data loading triggers change detection
    Promise.resolve().then(() => {
      this.loadAuditHistory();
    });
  }

  /**
   * Load audit history from API
   */
  async loadAuditHistory(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const params: Record<string, string | number | string[]> = {
        page: this.page(),
        limit: this.limit(),
      };

      const statuses = this.selectedStatuses();
      if (statuses.length > 0) {
        params['eventStatus'] = statuses;
      }

      if (this.dateRange() && this.dateRange()!.length === 2) {
        const [date1, date2] = this.dateRange()!;
        // Ensure dates are in correct order (start <= end)
        const start = date1 <= date2 ? date1 : date2;
        const end = date1 <= date2 ? date2 : date1;

        // Create UTC dates at start and end of day to ensure proper filtering
        // Use local date components to avoid timezone issues
        const startYear = start.getFullYear();
        const startMonth = start.getMonth();
        const startDay = start.getDate();
        const endYear = end.getFullYear();
        const endMonth = end.getMonth();
        const endDay = end.getDate();

        // Format as YYYY-MM-DD (ISO date format) using local date components
        // This ensures the date selected by user is the date sent to backend
        const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
        const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

        params['startDate'] = startDateStr;
        params['endDate'] = endDateStr;
      }

      const response: AuditHistoryResponse = await this.auth.getClient().getAuditHistory(params);

      this.events.set(response.data);
      this.total.set(response.total);
      this.totalPages.set(response.totalPages);
      this.page.set(response.page);
    } catch (err: unknown) {
      if (err instanceof NAuthClientError) {
        this.error.set(err.message);
      } else if (err instanceof Error) {
        this.error.set(err.message || 'Failed to load audit history');
      } else {
        this.error.set('Failed to load audit history');
      }
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handle page change
   *
   * @param event - Paginator event
   */
  onPageChange(event: PaginatorState): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.limit();
    const newPage = event.page !== undefined ? event.page + 1 : Math.floor(first / rows) + 1;
    this.page.set(newPage);
    this.limit.set(rows);
    this.loadAuditHistory();
  }

  /**
   * Handle status filter change
   */
  onStatusChange(): void {
    this.page.set(1);
    this.loadAuditHistory();
  }

  /**
   * Handle date range change
   */
  onDateRangeChange(): void {
    this.page.set(1);
    this.loadAuditHistory();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.dateRange.set(null);
    this.selectedStatuses.set([]);
    this.page.set(1);
    this.loadAuditHistory();
  }

  /**
   * Open event detail sidebar
   *
   * @param event - Audit event to display
   */
  openEventDetail(event: AuthAuditEvent): void {
    this.selectedEvent.set(event);
    this.sidebarVisible.set(true);
  }

  /**
   * Close event detail sidebar
   */
  closeEventDetail(): void {
    this.sidebarVisible.set(false);
    this.selectedEvent.set(null);
  }

  /**
   * Get status severity for tag
   *
   * @param status - Event status
   * @returns Tag severity
   */
  getStatusSeverity(status: AuthAuditEventStatus): 'success' | 'danger' | 'info' | 'warn' {
    switch (status) {
      case 'SUCCESS':
        return 'success';
      case 'FAILURE':
        return 'danger';
      case 'SUSPICIOUS':
        return 'warn';
      default:
        return 'info';
    }
  }

  /**
   * Format date for display
   *
   * @param date - Date to format
   * @returns Formatted date string
   */
  formatDate(date: string | Date): string {
    return this.datePipe.transform(date, 'medium') || '';
  }

  /**
   * Format metadata as JSON string
   * Handles metadata as object, string (JSON), or null
   *
   * @param metadata - Metadata object, string, or null
   * @returns Formatted JSON string
   */
  formatMetadata(metadata: Record<string, unknown> | string | null | undefined): string {
    if (!metadata) return '{}';
    if (typeof metadata === 'string') {
      try {
        const parsed = JSON.parse(metadata);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return metadata;
      }
    }
    return JSON.stringify(metadata, null, 2);
  }

  /**
   * Check if event has important details (reason or description with meaningful content)
   *
   * @param event - Audit event
   * @returns True if important details exist
   */
  hasImportantDetails(event: AuthAuditEvent): boolean {
    const hasReason = !!(event.reason && event.reason.trim().length > 0);
    const hasDescription = !!(event.description && event.description.trim().length > 0);
    return hasReason || hasDescription;
  }
}

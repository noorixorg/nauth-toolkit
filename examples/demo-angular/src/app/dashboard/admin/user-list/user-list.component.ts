import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  signal,
  computed,
  inject,
  ViewChild,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthUser, GetUsersRequest } from '@nauth-toolkit/client';
import { AccordionModule } from 'primeng/accordion';

/**
 * User type alias for backward compatibility
 * Maps to AuthUser (same structure as backend UserResponseDto)
 */
type User = AuthUser;
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { TagModule } from 'primeng/tag';
import { MenuModule, Menu } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';

/**
 * User List Component
 *
 * Displays paginated user table with advanced filtering capabilities.
 * Emits events for user actions and pagination changes.
 *
 * @example
 * ```typescript
 * <app-user-list
 *   [users]="users()"
 *   [total]="total()"
 *   [page]="page()"
 *   [limit]="limit()"
 *   [loading]="loading()"
 *   (pageChange)="onPageChange($event)"
 *   (userAction)="handleUserAction($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AccordionModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    TableModule,
    PaginatorModule,
    TagModule,
    MenuModule,
    TooltipModule,
    ButtonModule,
  ],
  providers: [DatePipe],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css',
})
export class UserListComponent implements OnInit {
  /**
   * Form builder for reactive forms
   */
  private readonly fb = inject(FormBuilder);

  /**
   * Date pipe for formatting
   */
  private readonly datePipe = new DatePipe('en-US');

  /**
   * Users data
   */
  @Input() users: User[] = [];

  /**
   * Total number of users
   */
  @Input() total = 0;

  /**
   * Current page (1-indexed)
   */
  @Input() page = 1;

  /**
   * Items per page
   */
  @Input() limit = 10;

  /**
   * Loading state
   */
  @Input() loading = false;

  /**
   * Emits when page changes
   */
  @Output() pageChange = new EventEmitter<PaginatorState>();

  /**
   * Emits when user action is triggered
   */
  @Output() userAction = new EventEmitter<{ action: string; user: User }>();

  /**
   * Emits when filters change
   */
  @Output() filtersChange = new EventEmitter<GetUsersRequest>();

  /**
   * Filter form group
   */
  filterForm!: FormGroup;

  /**
   * Accordion value (controls which panels are open)
   */
  accordionValue: number | number[] | null = null;

  /**
   * Date filter options
   */
  dateOperatorOptions = [
    { label: 'After', value: 'gt' },
    { label: 'On or After', value: 'gte' },
    { label: 'Before', value: 'lt' },
    { label: 'On or Before', value: 'lte' },
    { label: 'Exactly', value: 'eq' },
  ];

  /**
   * Computed pagination info
   */
  paginationInfo = computed(() => {
    const current = this.page;
    const total = this.total;
    const start = (current - 1) * this.limit + 1;
    const end = Math.min(current * this.limit, total);
    return { start, end, total };
  });

  /**
   * Selected user for actions
   */
  selectedUser = signal<User | null>(null);

  /**
   * Action menu items signal
   */
  actionMenuItems = signal<MenuItem[]>([]);

  /**
   * Reference to action menu
   */
  @ViewChild('actionMenu') actionMenu!: Menu;

  /**
   * Initialize component
   */
  ngOnInit(): void {
    this.initializeFilterForm();
  }

  /**
   * Initialize filter form
   */
  private initializeFilterForm(): void {
    this.filterForm = this.fb.group({
      email: [''],
      phone: [''],
      isEmailVerified: [null],
      isPhoneVerified: [null],
      hasSocialAuth: [null],
      isLocked: [null],
      mfaEnabled: [null],
      createdAtOperator: ['gte'],
      createdAtValue: [null],
      updatedAtOperator: ['gte'],
      updatedAtValue: [null],
      sortBy: ['createdAt'],
      sortOrder: ['DESC'],
    });

    // Emit filter changes
    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  /**
   * Apply filters and emit to parent
   */
  applyFilters(): void {
    const formValue = this.filterForm.value;
    const filters: GetUsersRequest = {
      page: 1, // Reset to first page when filtering
      limit: this.limit,
      email: formValue.email || undefined,
      phone: formValue.phone || undefined,
      isEmailVerified: formValue.isEmailVerified ?? undefined,
      isPhoneVerified: formValue.isPhoneVerified ?? undefined,
      hasSocialAuth: formValue.hasSocialAuth ?? undefined,
      isLocked: formValue.isLocked ?? undefined,
      mfaEnabled: formValue.mfaEnabled ?? undefined,
      sortBy: formValue.sortBy || 'createdAt',
      sortOrder: formValue.sortOrder || 'DESC',
    };

    // Add date filters if provided
    if (formValue.createdAtValue) {
      filters.createdAt = {
        operator: formValue.createdAtOperator,
        value: this.datePipe.transform(formValue.createdAtValue, 'yyyy-MM-dd') || '',
      };
    }

    if (formValue.updatedAtValue) {
      filters.updatedAt = {
        operator: formValue.updatedAtOperator,
        value: this.datePipe.transform(formValue.updatedAtValue, 'yyyy-MM-dd') || '',
      };
    }

    this.filtersChange.emit(filters);
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filterForm.reset({
      createdAtOperator: 'gte',
      updatedAtOperator: 'gte',
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });
  }

  /**
   * Handle page change
   */
  onPageChange(event: PaginatorState): void {
    this.pageChange.emit(event);
  }

  /**
   * Get action menu items for a specific user
   */
  getActionMenuItems(user: User): MenuItem[] {
    return [
      {
        label: 'Reset Password',
        icon: 'pi pi-key',
        command: () => this.emitUserAction('resetPassword', user),
      },
      {
        label: 'Force Password Change',
        icon: 'pi pi-exclamation-triangle',
        command: () => this.emitUserAction('forcePasswordChange', user),
      },
      {
        separator: true,
      },
      {
        label: 'Global Signout',
        icon: 'pi pi-sign-out',
        command: () => this.emitUserAction('globalSignout', user),
      },
      {
        separator: true,
      },
      {
        label: user.isLocked ? 'Enable User' : 'Disable User',
        icon: user.isLocked ? 'pi pi-unlock' : 'pi pi-lock',
        command: () => this.emitUserAction(user.isLocked ? 'enableUser' : 'disableUser', user),
      },
      {
        label: user.mfaExempt ? 'Revoke MFA Exemption' : 'Grant MFA Exemption',
        icon: 'pi pi-shield',
        command: () => this.emitUserAction('mfaExemption', user),
      },
      {
        separator: true,
      },
      {
        label: 'Delete User',
        icon: 'pi pi-trash',
        styleClass: 'text-red-600',
        command: () => this.emitUserAction('deleteUser', user),
      },
    ];
  }

  /**
   * Show action menu for user
   */
  showActionMenu(event: Event, user: User): void {
    this.selectedUser.set(user);
    this.actionMenuItems.set(this.getActionMenuItems(user));
    this.actionMenu.toggle(event);
  }

  /**
   * Emit user action event
   */
  private emitUserAction(action: string, user: User): void {
    this.userAction.emit({ action, user });
  }

  /**
   * Format date for display
   */
  formatDate(date: Date | string | null | undefined): string {
    if (!date) return '-';
    return this.datePipe.transform(date, 'short') || '-';
  }

  /**
   * Format user name for display
   */
  formatName(user: User): string {
    if (user.firstName || user.lastName) {
      return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    }
    return user.username || user.email.split('@')[0] || 'Unknown';
  }

  /**
   * Get status tag severity
   */
  getStatusSeverity(user: AuthUser): 'success' | 'danger' | 'warn' {
    if (user.isLocked) return 'danger';
    if (!user.isActive) return 'warn';
    return 'success';
  }

  /**
   * Get status label
   */
  getStatusLabel(user: User): string {
    if (user.isLocked) return 'Locked';
    if (!user.isActive) return 'Inactive';
    return 'Active';
  }
}

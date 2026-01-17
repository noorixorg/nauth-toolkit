import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  ChangeDetectorRef,
  ViewChild,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import {
  AdminService,
  AdminSignupRequest,
  AdminSignupSocialRequest,
  User,
  GetUsersRequest,
} from '../../services/admin.service';
import { MessageService, MenuItem, ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputMaskModule } from 'primeng/inputmask';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { TagModule } from 'primeng/tag';
import { MenuModule, Menu } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AccordionModule } from 'primeng/accordion';
import { UserListComponent } from './user-list/user-list.component';

/**
 * Phone number validator
 *
 * Validates E.164 format: +[country code][number]
 */
function phoneValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null; // Let required validator handle empty values
  }
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(control.value)) {
    return { phoneFormat: { message: 'Phone must be in E.164 format (e.g., +14155552671)' } };
  }
  return null;
}

/**
 * Admin Component
 *
 * Administrative user management interface with:
 * - Paginated user list with advanced filtering
 * - User actions (reset password, delete, disable, force password change)
 * - Create user accounts with override options
 *
 * @example
 * ```typescript
 * // Used within dashboard component
 * <app-admin />
 * ```
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    InputMaskModule,
    PasswordModule,
    CheckboxModule,
    DialogModule,
    MessageModule,
    TooltipModule,
    TableModule,
    PaginatorModule,
    TagModule,
    MenuModule,
    SelectModule,
    DatePickerModule,
    ConfirmDialogModule,
    AccordionModule,
    UserListComponent,
  ],
  providers: [DatePipe, ConfirmationService],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  /**
   * Admin service for API calls
   */
  private readonly adminService = inject(AdminService);

  /**
   * Form builder for reactive forms
   */
  private readonly fb = inject(FormBuilder);

  /**
   * Message service for toast notifications
   */
  private readonly messageService = inject(MessageService);

  /**
   * Confirmation service for dialogs
   */
  private readonly confirmationService = inject(ConfirmationService);

  /**
   * Change detector for manual change detection
   */
  private readonly cdr = inject(ChangeDetectorRef);

  /**
   * Date pipe for formatting
   */
  private readonly datePipe = new DatePipe('en-US');

  // ============================================================================
  // User List State
  // ============================================================================

  /**
   * Users data
   */
  users = signal<User[]>([]);

  /**
   * Total number of users
   */
  total = signal(0);

  /**
   * Current page (1-indexed)
   */
  page = signal(1);

  /**
   * Items per page
   */
  limit = signal(10);

  /**
   * Loading state for user list
   */
  loading = signal(false);

  /**
   * Error message
   */
  error = signal<string | null>(null);

  /**
   * Accordion value (controls which panels are open)
   * null = collapsed by default
   */
  accordionValue: number | number[] | null = null;

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
   * Get action menu items for a specific user
   * @param user - User to get menu items for
   * @returns Array of menu items
   */
  getActionMenuItems(user: User): MenuItem[] {
    return [
      {
        label: 'Admin Reset Password',
        icon: 'pi pi-key',
        command: () => this.openAdminResetPasswordDialog(user),
      },
      {
        label: 'Force Password Change',
        icon: 'pi pi-exclamation-triangle',
        command: () => this.forcePasswordChange(user),
      },
      {
        separator: true,
      },
      {
        label: user.isLocked ? 'Enable User' : 'Disable User',
        icon: user.isLocked ? 'pi pi-unlock' : 'pi pi-lock',
        command: () => (user.isLocked ? this.enableUser(user) : this.disableUser(user)),
      },
      {
        separator: true,
      },
      {
        label: 'Delete User',
        icon: 'pi pi-trash',
        styleClass: 'text-red-600',
        command: () => this.confirmDeleteUser(user),
      },
    ];
  }

  // ============================================================================
  // Filter State
  // ============================================================================

  /**
   * Filter form group
   */
  filterForm!: FormGroup;

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

  // ============================================================================
  // Create User Dialog State
  // ============================================================================

  /**
   * Create user form group
   */
  createUserForm!: FormGroup;

  /**
   * Dialog visibility state
   */
  showDialog = signal(false);

  /**
   * Loading state for form submission
   */
  createLoading = signal(false);

  /**
   * Error message for create user
   */
  createError = signal<string | null>(null);

  /**
   * Success message for create user
   */
  createSuccess = signal<string | null>(null);

  // ============================================================================
  // Import Social User Dialog State
  // ============================================================================

  /**
   * Import social user form group
   */
  importSocialUserForm!: FormGroup;

  /**
   * Dialog visibility state for import social user
   */
  showImportSocialDialog = signal(false);

  /**
   * Loading state for import social user form submission
   */
  importSocialLoading = signal(false);

  /**
   * Error message for import social user
   */
  importSocialError = signal<string | null>(null);

  /**
   * Success message for import social user
   */
  importSocialSuccess = signal<string | null>(null);

  /**
   * Generated password from last user creation
   */
  generatedPassword = signal<string | null>(null);

  /**
   * Show generated password dialog
   */
  showPasswordDialog = signal(false);

  // ============================================================================
  // Reset Password Dialog State
  // ============================================================================

  /**
   * Admin reset password form (for choosing delivery method)
   */
  adminResetPasswordForm!: FormGroup;

  /**
   * Show admin reset password dialog (new workflow)
   */
  showAdminResetPasswordDialog = signal(false);

  /**
   * Loading state for admin reset password
   */
  adminResetPasswordLoading = signal(false);

  /**
   * Computed pagination info
   */
  paginationInfo = computed(() => {
    const current = this.page();
    const total = this.total();
    const start = (current - 1) * this.limit() + 1;
    const end = Math.min(current * this.limit(), total);
    return { start, end, total };
  });

  /**
   * Initialize component
   */
  ngOnInit(): void {
    // Note: filterForm is now managed by user-list component
    // We still initialize it for backward compatibility
    this.initializeFilterForm();
    this.initializeCreateUserForm();
    this.initializeImportSocialUserForm();
    this.initializeAdminResetPasswordForm();
    // Defer initial load to next tick
    Promise.resolve().then(() => {
      this.loadUsers();
    });
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
  }

  /**
   * Initialize create user form
   */
  private initializeCreateUserForm(): void {
    this.createUserForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: ['', [Validators.minLength(8), Validators.maxLength(128)]],
      username: [
        '',
        [
          Validators.minLength(3),
          Validators.maxLength(255),
          Validators.pattern(/^[a-zA-Z0-9_-]+$/),
        ],
      ],
      firstName: [
        '',
        [
          Validators.minLength(1),
          Validators.maxLength(100),
          Validators.pattern(/^[a-zA-Z\s\-']+$/),
        ],
      ],
      lastName: [
        '',
        [
          Validators.minLength(1),
          Validators.maxLength(100),
          Validators.pattern(/^[a-zA-Z\s\-']+$/),
        ],
      ],
      phone: ['', [phoneValidator, Validators.maxLength(20)]],
      isEmailVerified: [false],
      isPhoneVerified: [false],
      mustChangePassword: [false],
      generatePassword: [false],
    });

    // Update password validators when generatePassword changes
    this.createUserForm.get('generatePassword')?.valueChanges.subscribe((generatePassword) => {
      const passwordControl = this.createUserForm.get('password');
      if (generatePassword) {
        passwordControl?.clearValidators();
      } else {
        passwordControl?.setValidators([
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(128),
        ]);
      }
      passwordControl?.updateValueAndValidity();
    });
  }

  /**
   * Initialize import social user form
   */
  private initializeImportSocialUserForm(): void {
    this.importSocialUserForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      provider: ['google', [Validators.required]],
      providerId: ['', [Validators.required, Validators.maxLength(255)]],
      firstName: [
        '',
        [
          Validators.minLength(1),
          Validators.maxLength(100),
          Validators.pattern(/^[a-zA-Z\s\-']+$/),
        ],
      ],
      lastName: [
        '',
        [
          Validators.minLength(1),
          Validators.maxLength(100),
          Validators.pattern(/^[a-zA-Z\s\-']+$/),
        ],
      ],
      phone: ['', [phoneValidator, Validators.maxLength(20)]],
      password: ['', [Validators.minLength(8), Validators.maxLength(128)]],
      isPhoneVerified: [false],
      mustChangePassword: [false],
    });
  }

  /**
   * Initialize admin reset password form
   */
  private initializeAdminResetPasswordForm(): void {
    this.adminResetPasswordForm = this.fb.group({
      deliveryMethod: ['email', [Validators.required]],
      revokeSessions: [true],
      reason: ['', [Validators.maxLength(500)]],
    });
  }

  // ============================================================================
  // User List Methods
  // ============================================================================

  /**
   * Load users from API
   */
  async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const filterValue = this.filterForm.value;
      const params: GetUsersRequest = {
        page: this.page(),
        limit: this.limit(),
        sortBy: filterValue.sortBy || 'createdAt',
        sortOrder: filterValue.sortOrder || 'DESC',
      };

      // Add string filters
      if (filterValue.email) params.email = filterValue.email.trim();
      if (filterValue.phone) params.phone = filterValue.phone.trim();

      // Add boolean filters
      if (filterValue.isEmailVerified !== null && filterValue.isEmailVerified !== '') {
        params.isEmailVerified = filterValue.isEmailVerified === true;
      }
      if (filterValue.isPhoneVerified !== null && filterValue.isPhoneVerified !== '') {
        params.isPhoneVerified = filterValue.isPhoneVerified === true;
      }
      if (filterValue.hasSocialAuth !== null && filterValue.hasSocialAuth !== '') {
        params.hasSocialAuth = filterValue.hasSocialAuth === true;
      }
      if (filterValue.isLocked !== null && filterValue.isLocked !== '') {
        params.isLocked = filterValue.isLocked === true;
      }
      if (filterValue.mfaEnabled !== null && filterValue.mfaEnabled !== '') {
        params.mfaEnabled = filterValue.mfaEnabled === true;
      }

      // Add date filters
      if (filterValue.createdAtValue) {
        params.createdAt = {
          operator: filterValue.createdAtOperator || 'gte',
          value: filterValue.createdAtValue,
        };
      }
      if (filterValue.updatedAtValue) {
        params.updatedAt = {
          operator: filterValue.updatedAtOperator || 'gte',
          value: filterValue.updatedAtValue,
        };
      }

      const response = await this.adminService.getUsers(params);

      this.users.set(response.users);
      this.total.set(response.pagination.total);
      this.page.set(response.pagination.page);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load users';
      this.error.set(errorMessage);
      this.messageService.add({
        severity: 'error',
        summary: 'Load Users Failed',
        detail: errorMessage,
      });
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handle page change
   */
  onPageChange(event: PaginatorState): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.limit();
    const newPage = event.page !== undefined ? event.page + 1 : Math.floor(first / rows) + 1;
    this.page.set(newPage);
    this.limit.set(rows);
    this.loadUsers();
  }

  /**
   * Handle user action from user-list component
   */
  handleUserAction(event: { action: string; user: User }): void {
    switch (event.action) {
      case 'resetPassword':
        this.openAdminResetPasswordDialog(event.user);
        break;
      case 'forcePasswordChange':
        this.forcePasswordChange(event.user);
        break;
      case 'enableUser':
        this.enableUser(event.user);
        break;
      case 'disableUser':
        this.disableUser(event.user);
        break;
      case 'deleteUser':
        this.confirmDeleteUser(event.user);
        break;
    }
  }

  /**
   * Handle filters change from user-list component
   */
  onFiltersChange(filters: GetUsersRequest): void {
    // Update filter form with new values
    this.filterForm.patchValue({
      email: filters.email || '',
      phone: filters.phone || '',
      isEmailVerified: filters.isEmailVerified ?? null,
      isPhoneVerified: filters.isPhoneVerified ?? null,
      hasSocialAuth: filters.hasSocialAuth ?? null,
      isLocked: filters.isLocked ?? null,
      mfaEnabled: filters.mfaEnabled ?? null,
      sortBy: filters.sortBy || 'createdAt',
      sortOrder: filters.sortOrder || 'DESC',
    });

    // Update page and limit
    if (filters.page) this.page.set(filters.page);
    if (filters.limit) this.limit.set(filters.limit);

    // Load users with new filters
    this.loadUsers();
  }

  /**
   * Apply filters
   */
  applyFilters(): void {
    this.page.set(1);
    this.loadUsers();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filterForm.reset({
      isEmailVerified: null,
      isPhoneVerified: null,
      hasSocialAuth: null,
      isLocked: null,
      mfaEnabled: null,
      createdAtOperator: 'gte',
      createdAtValue: null,
      updatedAtOperator: 'gte',
      updatedAtValue: null,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });
    this.page.set(1);
    this.loadUsers();
  }

  /**
   * Format date for display
   */
  /**
   * Format user's full name from firstName and lastName
   * @param user - User object with firstName and lastName
   * @returns Formatted full name or '-' if no name available
   */
  formatName(user: { firstName?: string | null; lastName?: string | null }): string {
    const parts: string[] = [];
    if (user.firstName) parts.push(user.firstName);
    if (user.lastName) parts.push(user.lastName);
    return parts.length > 0 ? parts.join(' ') : '-';
  }

  formatDate(date: string | Date): string {
    return this.datePipe.transform(date, 'medium') || '';
  }

  /**
   * Show action menu for user
   */
  showActionMenu(event: Event, user: User): void {
    this.selectedUser.set(user);
    this.actionMenuItems.set(this.getActionMenuItems(user));
    this.actionMenu.toggle(event);
    event.stopPropagation();
  }

  // ============================================================================
  // User Action Methods
  // ============================================================================

  /**
   * Open admin reset password dialog (new workflow)
   */
  openAdminResetPasswordDialog(user: User): void {
    this.selectedUser.set(user);
    this.adminResetPasswordForm.reset({
      deliveryMethod: user.email ? 'email' : 'sms',
      revokeSessions: true,
      reason: '',
    });
    this.showAdminResetPasswordDialog.set(true);
  }

  /**
   * Close admin reset password dialog
   */
  closeAdminResetPasswordDialog(): void {
    this.showAdminResetPasswordDialog.set(false);
    this.selectedUser.set(null);
    this.adminResetPasswordForm.reset();
  }

  /**
   * Handle admin reset password form submission
   */
  async onSubmitAdminResetPassword(): Promise<void> {
    if (this.adminResetPasswordForm.invalid) {
      Object.keys(this.adminResetPasswordForm.controls).forEach((key) => {
        this.adminResetPasswordForm.get(key)?.markAsTouched();
      });
      return;
    }

    const user = this.selectedUser();
    if (!user) return;

    this.adminResetPasswordLoading.set(true);

    try {
      const formValue = this.adminResetPasswordForm.value;
      const baseUrl = `${window.location.origin}/admin-reset-password`;

      const result = await this.adminService.adminResetPassword({
        sub: user.sub,
        deliveryMethod: formValue.deliveryMethod,
        baseUrl,
        revokeSessions: formValue.revokeSessions,
        reason: formValue.reason || undefined,
      });

      this.adminResetPasswordLoading.set(false);
      this.messageService.add({
        severity: 'success',
        summary: 'Password Reset Initiated',
        detail: `Reset code sent to ${result.destination || 'user'}. ${result.sessionsRevoked ? `${result.sessionsRevoked} session(s) revoked.` : ''}`,
      });
      this.loadUsers();
      this.closeAdminResetPasswordDialog();
    } catch (err: unknown) {
      this.adminResetPasswordLoading.set(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate password reset';
      this.messageService.add({
        severity: 'error',
        summary: 'Reset Password Failed',
        detail: errorMessage,
      });
    }
  }

  /**
   * Force password change on next login
   */
  async forcePasswordChange(user: User): Promise<void> {
    this.confirmationService.confirm({
      message: `Are you sure you want to force ${user.email} to change their password on next login?`,
      header: 'Force Password Change',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-warning',
      accept: async () => {
        try {
          await this.adminService.forcePasswordChange(user.sub);
          this.messageService.add({
            severity: 'success',
            summary: 'Password Change Required',
            detail: `${user.email} will be required to change their password on next login.`,
          });
          this.loadUsers();
        } catch (err: unknown) {
          const errorMessage =
            err instanceof Error ? err.message : 'Failed to force password change';
          this.messageService.add({
            severity: 'error',
            summary: 'Force Password Change Failed',
            detail: errorMessage,
          });
        }
      },
    });
  }

  /**
   * Disable user account
   */
  async disableUser(user: User): Promise<void> {
    this.confirmationService.confirm({
      message: `Are you sure you want to disable user ${user.email}? This will lock their account and revoke all active sessions.`,
      header: 'Disable User',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        try {
          const response = await this.adminService.disableUser(user.sub);
          this.messageService.add({
            severity: 'success',
            summary: 'User Disabled',
            detail: `User ${user.email} has been disabled. ${response.revokedSessions} session(s) revoked.`,
          });
          this.loadUsers();
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to disable user';
          this.messageService.add({
            severity: 'error',
            summary: 'Disable User Failed',
            detail: errorMessage,
          });
        }
      },
    });
  }

  /**
   * Enable user account
   */
  async enableUser(user: User): Promise<void> {
    this.confirmationService.confirm({
      message: `Are you sure you want to enable (unlock) user ${user.email}? This will allow them to login again.`,
      header: 'Enable User',
      icon: 'pi pi-check-circle',
      acceptButtonStyleClass: 'p-button-success',
      accept: async () => {
        try {
          await this.adminService.enableUser(user.sub);
          this.messageService.add({
            severity: 'success',
            summary: 'User Enabled',
            detail: `User ${user.email} has been enabled and can now login.`,
          });
          this.loadUsers();
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to enable user';
          this.messageService.add({
            severity: 'error',
            summary: 'Enable User Failed',
            detail: errorMessage,
          });
        }
      },
    });
  }

  /**
   * Confirm and delete user
   */
  confirmDeleteUser(user: User): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to permanently delete user ${user.email}? This action cannot be undone and will delete all associated data including sessions, tokens, and audit trails.`,
      header: 'Delete User',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        try {
          await this.adminService.deleteUser(user.sub);
          this.messageService.add({
            severity: 'success',
            summary: 'User Deleted',
            detail: `User ${user.email} and all associated data have been permanently deleted.`,
          });
          this.loadUsers();
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to delete user';
          this.messageService.add({
            severity: 'error',
            summary: 'Delete User Failed',
            detail: errorMessage,
          });
        }
      },
    });
  }

  // ============================================================================
  // Create User Methods
  // ============================================================================

  /**
   * Open create user dialog
   */
  openCreateUserDialog(): void {
    this.createUserForm.reset({
      isEmailVerified: false,
      isPhoneVerified: false,
      mustChangePassword: false,
      generatePassword: false,
    });
    this.createError.set(null);
    this.createSuccess.set(null);
    this.generatedPassword.set(null);
    this.showDialog.set(true);
  }

  /**
   * Close create user dialog
   */
  closeDialog(): void {
    this.showDialog.set(false);
    this.createError.set(null);
    this.createSuccess.set(null);
  }

  // ============================================================================
  // Import Social User Methods
  // ============================================================================

  /**
   * Open import social user dialog
   */
  openImportSocialUserDialog(): void {
    this.importSocialUserForm.reset({
      provider: 'google',
      isPhoneVerified: false,
      mustChangePassword: false,
    });
    this.importSocialError.set(null);
    this.importSocialSuccess.set(null);
    this.showImportSocialDialog.set(true);
  }

  /**
   * Close import social user dialog
   */
  closeImportSocialDialog(): void {
    this.showImportSocialDialog.set(false);
    this.importSocialError.set(null);
    this.importSocialSuccess.set(null);
  }

  /**
   * Handle import social user form submission
   */
  onSubmitImportSocial(): void {
    if (this.importSocialUserForm.invalid) {
      Object.keys(this.importSocialUserForm.controls).forEach((key) => {
        this.importSocialUserForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.importSocialLoading.set(true);
    this.importSocialError.set(null);
    this.importSocialSuccess.set(null);

    const formValue = this.importSocialUserForm.value;
    const dto: AdminSignupSocialRequest = {
      email: formValue.email.trim().toLowerCase(),
      provider: formValue.provider,
      providerId: formValue.providerId.trim(),
      firstName: formValue.firstName?.trim() || undefined,
      lastName: formValue.lastName?.trim() || undefined,
      phone: formValue.phone?.replace(/\s/g, '') || undefined,
      password: formValue.password || undefined,
      // Note: isEmailVerified is automatically set to true by backend (like normal social signup)
      isPhoneVerified: formValue.isPhoneVerified || false,
      mustChangePassword: formValue.mustChangePassword || false,
    };

    this.adminService
      .importSocialUser(dto)
      .then((response) => {
        this.importSocialLoading.set(false);
        this.importSocialSuccess.set(
          `Social user ${response.user.email} imported successfully. Provider: ${response.socialAccount.provider}`,
        );
        this.loadUsers();
        setTimeout(() => {
          this.closeImportSocialDialog();
        }, 2000);
      })
      .catch((err: unknown) => {
        this.importSocialLoading.set(false);
        const errorMessage = err instanceof Error ? err.message : 'Failed to import social user';
        this.importSocialError.set(errorMessage);
      });
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (this.createUserForm.invalid) {
      Object.keys(this.createUserForm.controls).forEach((key) => {
        this.createUserForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.createLoading.set(true);
    this.createError.set(null);
    this.createSuccess.set(null);
    this.generatedPassword.set(null);

    const formValue = this.createUserForm.value;
    const dto: AdminSignupRequest = {
      email: formValue.email.trim().toLowerCase(),
      username: formValue.username?.trim() || undefined,
      firstName: formValue.firstName?.trim() || undefined,
      lastName: formValue.lastName?.trim() || undefined,
      phone: formValue.phone?.replace(/\s/g, '') || undefined,
      isEmailVerified: formValue.isEmailVerified || false,
      isPhoneVerified: formValue.isPhoneVerified || false,
      mustChangePassword: formValue.mustChangePassword || false,
      generatePassword: formValue.generatePassword || false,
    };

    if (!dto.generatePassword && formValue.password) {
      dto.password = formValue.password;
    }

    this.adminService
      .createUser(dto)
      .then((response) => {
        this.createLoading.set(false);
        this.createSuccess.set(`User ${response.user.email} created successfully`);
        this.createUserForm.reset({
          isEmailVerified: false,
          isPhoneVerified: false,
          mustChangePassword: false,
          generatePassword: false,
        });

        if (response.generatedPassword) {
          this.generatedPassword.set(response.generatedPassword);
          this.showPasswordDialog.set(true);
        } else {
          setTimeout(() => {
            this.closeDialog();
          }, 2000);
        }

        this.messageService.add({
          severity: 'success',
          summary: 'User Created',
          detail: `User ${response.user.email} has been created successfully`,
        });

        // Reload user list
        this.loadUsers();
      })
      .catch((err: unknown) => {
        this.createLoading.set(false);
        const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
        this.createError.set(errorMessage);
        this.messageService.add({
          severity: 'error',
          summary: 'Create User Failed',
          detail: errorMessage,
        });
      });
  }

  /**
   * Close password dialog and copy password to clipboard
   */
  async copyPasswordAndClose(): Promise<void> {
    const password = this.generatedPassword();
    if (password) {
      try {
        await navigator.clipboard.writeText(password);
        this.messageService.add({
          severity: 'success',
          summary: 'Password Copied',
          detail: 'Generated password has been copied to clipboard',
        });
      } catch {
        // Clipboard API not available
      }
    }
    this.showPasswordDialog.set(false);
    this.generatedPassword.set(null);
    this.closeDialog();
  }

  /**
   * Close password dialog without copying
   */
  closePasswordDialog(): void {
    this.showPasswordDialog.set(false);
    this.generatedPassword.set(null);
    this.closeDialog();
  }
}

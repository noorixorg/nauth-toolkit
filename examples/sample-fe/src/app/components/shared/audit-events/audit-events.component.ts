import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

/**
 * Audit Events Component
 *
 * Displays authentication audit history in a responsive table with pagination.
 */
@Component({
  selector: 'app-audit-events',
  templateUrl: './audit-events.component.html',
  styleUrls: ['./audit-events.component.scss'],
  imports: [CommonModule, FormsModule],
  standalone: true,
})
export class AuditEventsComponent implements OnInit, OnDestroy {
  auditHistory: {
    data: Array<Record<string, unknown>>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } | null = null;
  isLoadingAudit = false;
  auditError = '';
  currentAuditPage = 1;
  auditPageSize = 50;
  // Preview panel state
  previewEvent: Record<string, unknown> | null = null;
  isMobile = false;
  private resizeHandler = () => this.checkMobile();

  // Filter state
  availableEventTypes: string[] = [
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'LOGIN_BLOCKED',
    'SESSION_CREATED',
    'SESSION_REVOKED',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_COMPLETED',
    'PASSWORD_FORCE_CHANGE_SET',
    'PASSWORD_FORCE_CHANGE_COMPLETED',
    'MFA_ENABLED',
    'MFA_DISABLED',
    'MFA_DEVICE_ADDED',
    'MFA_DEVICE_REMOVED',
    'MFA_DEVICE_UPDATED',
    'MFA_VERIFICATION_SUCCESS',
    'MFA_VERIFICATION_FAILED',
    'MFA_EXEMPTION_GRANTED',
    'MFA_EXEMPTION_REVOKED',
    'MFA_BACKUP_CODES_GENERATED',
    'MFA_BACKUP_CODE_USED',
    'MFA_PREFERRED_METHOD_UPDATED',
    'ADAPTIVE_MFA_RISK_ASSESSED',
    'ADAPTIVE_MFA_TRIGGERED',
    'ADAPTIVE_MFA_BYPASSED',
    'EMAIL_VERIFIED',
    'EMAIL_VERIFICATION_REQUESTED',
    'EMAIL_VERIFICATION_FAILED',
    'PHONE_VERIFIED',
    'PHONE_VERIFICATION_REQUESTED',
    'PHONE_VERIFICATION_FAILED',
    'ACCOUNT_CREATED',
    'ACCOUNT_ACTIVATED',
    'ACCOUNT_DEACTIVATED',
    'ACCOUNT_LOCKED',
    'ACCOUNT_UNLOCKED',
    'ACCOUNT_DELETED',
    'PROFILE_UPDATED',
    'EMAIL_CHANGED',
    'PHONE_CHANGED',
    'USERNAME_CHANGED',
    'SOCIAL_LOGIN',
    'SOCIAL_ACCOUNT_LINKED',
    'SOCIAL_ACCOUNT_UNLINKED',
    'CHALLENGE_CREATED',
    'CHALLENGE_COMPLETED',
    'CHALLENGE_ATTEMPT_FAILED',
    'SUSPICIOUS_ACTIVITY',
  ];
  selectedEventTypes: Set<string> = new Set();
  selectedEventStatus: string = '';
  startDate: string = '';
  endDate: string = '';
  showFilters = false;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Initialize filters with defaults
    this.initializeFilters();
    this.checkMobile();
    // Listen for window resize to update mobile detection
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.resizeHandler);
    }
    // Load audit history with default filters
    this.loadAuditHistory();
  }

  /**
   * Initialize filters with default values
   */
  initializeFilters(): void {
    // Select all event types by default
    this.selectedEventTypes = new Set(this.availableEventTypes);
    // Default date range: last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    this.endDate = this.formatDateForInput(endDate);
    this.startDate = this.formatDateForInput(startDate);
    // No status filter by default
    this.selectedEventStatus = '';
  }

  /**
   * Format date for HTML date input
   *
   * @param date - Date object
   * @returns ISO date string (YYYY-MM-DD)
   */
  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Check if device is mobile
   */
  checkMobile(): void {
    if (typeof window !== 'undefined') {
      this.isMobile = window.innerWidth < 768;
    }
  }

  /**
   * Cleanup on component destroy
   */
  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  /**
   * Load audit history
   *
   * @param page - Page number to load
   */
  loadAuditHistory(page = 1): void {
    this.isLoadingAudit = true;
    this.auditError = '';
    this.currentAuditPage = page;

    // Build filter parameters
    const params: {
      page?: number;
      limit?: number;
      eventTypes?: string;
      eventStatus?: string;
      startDate?: string;
      endDate?: string;
    } = {
      page,
      limit: this.auditPageSize,
    };

    // Add event types filter if not all are selected
    if (
      this.selectedEventTypes.size > 0 &&
      this.selectedEventTypes.size < this.availableEventTypes.length
    ) {
      params.eventTypes = Array.from(this.selectedEventTypes).join(',');
    }

    // Add status filter if selected
    if (this.selectedEventStatus) {
      params.eventStatus = this.selectedEventStatus;
    }

    // Add date range filters
    if (this.startDate) {
      // Convert to ISO string with time (start of day)
      const startDateTime = `${this.startDate}T00:00:00`;
      params.startDate = new Date(startDateTime).toISOString();
    }
    if (this.endDate) {
      // Convert to ISO string with time (end of day)
      const endDateTime = `${this.endDate}T23:59:59`;
      params.endDate = new Date(endDateTime).toISOString();
    }

    this.authService.getAuditHistory(params).subscribe({
      next: (history) => {
        this.auditHistory = history;
        this.isLoadingAudit = false;
      },
      error: (error) => {
        this.auditError = error.error?.message || 'Failed to load audit history';
        this.isLoadingAudit = false;
      },
    });
  }

  /**
   * Navigate to specific page
   *
   * @param page - Page number to navigate to
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= (this.auditHistory?.totalPages || 1)) {
      this.loadAuditHistory(page);
    }
  }

  /**
   * Toggle event type selection
   *
   * @param eventType - Event type to toggle
   */
  toggleEventType(eventType: string): void {
    if (this.selectedEventTypes.has(eventType)) {
      this.selectedEventTypes.delete(eventType);
    } else {
      this.selectedEventTypes.add(eventType);
    }
  }

  /**
   * Select all event types
   */
  selectAllEventTypes(): void {
    this.selectedEventTypes = new Set(this.availableEventTypes);
  }

  /**
   * Deselect all event types
   */
  deselectAllEventTypes(): void {
    this.selectedEventTypes.clear();
  }

  /**
   * Check if event type is selected
   *
   * @param eventType - Event type to check
   * @returns True if selected
   */
  isEventTypeSelected(eventType: string): boolean {
    return this.selectedEventTypes.has(eventType);
  }

  /**
   * Check if all event types are selected
   *
   * @returns True if all are selected
   */
  areAllEventTypesSelected(): boolean {
    return this.selectedEventTypes.size === this.availableEventTypes.length;
  }

  /**
   * Apply filters and reload data
   */
  applyFilters(): void {
    this.currentAuditPage = 1;
    this.loadAuditHistory(1);
  }

  /**
   * Reset filters to defaults
   */
  resetFilters(): void {
    this.initializeFilters();
    this.applyFilters();
  }

  /**
   * Toggle filters panel visibility
   */
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  /**
   * Format event type for display
   *
   * @param eventType - Event type string (SNAKE_CASE)
   * @returns Formatted event type (Title Case)
   */
  formatEventType(eventType: unknown): string {
    if (typeof eventType !== 'string') {
      return String(eventType || 'UNKNOWN');
    }
    // Convert SNAKE_CASE to Title Case
    return eventType
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Format date for display
   *
   * @param date - Date string or Date object
   * @returns Formatted date string
   */
  formatDate(date: unknown): string {
    if (!date) {
      return '-';
    }
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : (date as Date);
      if (isNaN(dateObj.getTime())) {
        return '-';
      }
      return dateObj.toLocaleString();
    } catch {
      return '-';
    }
  }

  /**
   * Get property from event object
   *
   * @param event - Event object
   * @param key - Property key
   * @returns Property value
   */
  getEventProperty(event: Record<string, unknown>, key: string): unknown {
    return event[key];
  }

  /**
   * Filter truthy values from array and convert to strings
   *
   * @param arr - Array to filter
   * @returns Filtered array of strings
   */
  filterTruthy(arr: unknown[]): string[] {
    return arr.filter((item) => !!item).map((item) => String(item));
  }

  /**
   * Get location string from event
   *
   * @param event - Event object
   * @returns Location string
   */
  getLocation(event: Record<string, unknown>): string {
    const city = event['ipCity'];
    const country = event['ipCountry'];
    const parts = [];
    if (city) parts.push(String(city));
    if (country) parts.push(String(country));
    return parts.length > 0 ? parts.join(', ') : '-';
  }

  /**
   * Get device string from event
   *
   * @param event - Event object
   * @returns Device string
   */
  getDevice(event: Record<string, unknown>): string {
    const deviceName = event['deviceName'];
    if (deviceName) {
      return String(deviceName);
    }
    const platform = event['platform'];
    const browser = event['browser'];
    const parts = [];
    if (platform) parts.push(String(platform));
    if (browser) parts.push(String(browser));
    return parts.length > 0 ? parts.join(' / ') : '-';
  }

  /**
   * Format MFA method for display
   *
   * @param method - MFA method string (totp, sms, passkey)
   * @returns Formatted method name
   */
  formatMFAMethod(method: unknown): string {
    if (!method || typeof method !== 'string') {
      return '';
    }
    const methodUpper = method.toUpperCase();
    const methodMap: Record<string, string> = {
      TOTP: 'TOTP (Authenticator App)',
      SMS: 'SMS',
      PASSKEY: 'Passkey',
      BACKUP: 'Backup Code',
    };
    return methodMap[methodUpper] || method;
  }

  /**
   * Get enhanced event type label with MFA method
   *
   * @param event - Event object
   * @returns Enhanced event type label
   */
  getEnhancedEventTypeLabel(event: Record<string, unknown>): string {
    const eventType = this.getEventProperty(event, 'eventType');
    const baseLabel = this.formatEventType(eventType);

    // For MFA verification events, add method information
    if (eventType === 'MFA_VERIFICATION_SUCCESS' || eventType === 'MFA_VERIFICATION_FAILED') {
      const authMethod = event['authMethod'];
      const eventMetadata = event['metadata'];
      let mfaMethod: string | null = null;

      // Try to get MFA method from authMethod or metadata
      if (authMethod && typeof authMethod === 'string') {
        mfaMethod = this.formatMFAMethod(authMethod);
      } else if (eventMetadata && typeof eventMetadata === 'object' && eventMetadata !== null) {
        const meta = eventMetadata as Record<string, unknown>;
        if (meta['mfaMethod'] && typeof meta['mfaMethod'] === 'string') {
          mfaMethod = this.formatMFAMethod(meta['mfaMethod']);
        }
      }

      if (mfaMethod) {
        return `${baseLabel} (${mfaMethod})`;
      }
    }

    return baseLabel;
  }

  /**
   * Get status class for event
   *
   * @param event - Event object
   * @returns Status class string
   */
  getStatusClass(event: Record<string, unknown>): string {
    const status = event['eventStatus'];
    if (typeof status === 'string') {
      return `status-${status.toLowerCase()}`;
    }
    return '';
  }

  /**
   * Show preview panel for event
   *
   * @param event - Event object to preview
   * @param eventObj - Mouse or Touch event
   */
  showPreview(event: Record<string, unknown>, eventObj: MouseEvent | TouchEvent): void {
    if (this.hasMetadata(event)) {
      eventObj.preventDefault();
      eventObj.stopPropagation();
      this.previewEvent = event;
    }
  }

  /**
   * Hide preview panel
   */
  hidePreview(): void {
    this.previewEvent = null;
  }

  /**
   * Toggle preview panel (close if open, open if closed)
   *
   * @param event - Event object to preview
   * @param eventObj - Mouse or Touch event
   */
  togglePreview(event: Record<string, unknown>, eventObj: MouseEvent | TouchEvent): void {
    if (this.previewEvent === event) {
      // Same event clicked - close panel
      this.hidePreview();
    } else if (this.hasMetadata(event)) {
      // Different event with metadata - show panel
      this.showPreview(event, eventObj);
    }
  }

  /**
   * Get preview metadata fields
   *
   * @param event - Event object
   * @returns Array of metadata fields to display
   */
  getPreviewFields(event: Record<string, unknown>): Array<{ label: string; value: string }> {
    const fields: Array<{ label: string; value: string }> = [];

    // IP Address details (if not already shown in table)
    const ipAddress = event['ipAddress'];
    if (ipAddress) {
      fields.push({ label: 'IP Address', value: String(ipAddress) });
    }

    const ipCountry = event['ipCountry'];
    if (ipCountry) {
      fields.push({ label: 'IP Country', value: String(ipCountry) });
    }

    const ipCity = event['ipCity'];
    if (ipCity) {
      fields.push({ label: 'IP City', value: String(ipCity) });
    }

    // Device information
    const deviceId = event['deviceId'];
    if (deviceId) {
      fields.push({ label: 'Device ID', value: String(deviceId) });
    }

    const deviceName = event['deviceName'];
    if (deviceName) {
      fields.push({ label: 'Device Name', value: String(deviceName) });
    }

    const deviceType = event['deviceType'];
    if (deviceType) {
      fields.push({ label: 'Device Type', value: String(deviceType) });
    }

    const platform = event['platform'];
    if (platform) {
      fields.push({ label: 'Platform', value: String(platform) });
    }

    const browser = event['browser'];
    if (browser) {
      fields.push({ label: 'Browser', value: String(browser) });
    }

    const userAgent = event['userAgent'];
    if (userAgent) {
      fields.push({ label: 'User Agent', value: String(userAgent) });
    }

    // Session information
    const sessionId = event['sessionId'];
    if (sessionId !== null && sessionId !== undefined) {
      fields.push({ label: 'Session ID', value: String(sessionId) });
    }

    const challengeSessionId = event['challengeSessionId'];
    if (challengeSessionId !== null && challengeSessionId !== undefined) {
      fields.push({ label: 'Challenge Session ID', value: String(challengeSessionId) });
    }

    // Authentication method (enhanced display for MFA methods)
    const authMethod = event['authMethod'];
    if (authMethod) {
      const formattedMethod = this.formatMFAMethod(authMethod) || String(authMethod);
      fields.push({ label: 'Authentication Method', value: formattedMethod });
    }

    // MFA method from metadata (if different from authMethod)
    // Note: We check metadata here before the final metadata section below
    const eventMetadata = event['metadata'];
    if (eventMetadata && typeof eventMetadata === 'object' && eventMetadata !== null) {
      const meta = eventMetadata as Record<string, unknown>;
      if (meta['mfaMethod'] && typeof meta['mfaMethod'] === 'string') {
        const mfaMethodFormatted = this.formatMFAMethod(meta['mfaMethod']);
        // Only add if different from authMethod or if authMethod is missing
        if (
          !authMethod ||
          String(authMethod).toUpperCase() !== String(meta['mfaMethod']).toUpperCase()
        ) {
          fields.push({ label: 'MFA Method', value: mfaMethodFormatted });
        }
      }
    }

    // Risk assessment
    const riskFactor = event['riskFactor'];
    if (riskFactor !== null && riskFactor !== undefined) {
      fields.push({ label: 'Risk Factor', value: String(riskFactor) });
    }

    const riskFactors = event['riskFactors'];
    if (riskFactors && Array.isArray(riskFactors) && riskFactors.length > 0) {
      fields.push({ label: 'Risk Factors', value: riskFactors.join(', ') });
    }

    const adaptiveMfaTriggered = event['adaptiveMfaTriggered'];
    if (adaptiveMfaTriggered !== null && adaptiveMfaTriggered !== undefined) {
      fields.push({ label: 'Adaptive MFA Triggered', value: adaptiveMfaTriggered ? 'Yes' : 'No' });
    }

    // Audit information
    const performedBy = event['performedBy'];
    if (performedBy) {
      fields.push({ label: 'Performed By', value: String(performedBy) });
    }

    const reason = event['reason'];
    if (reason) {
      fields.push({ label: 'Reason', value: String(reason) });
    }

    const description = event['description'];
    if (description) {
      fields.push({ label: 'Description', value: String(description) });
    }

    // Extract individual metadata fields for better readability
    if (eventMetadata && typeof eventMetadata === 'object' && eventMetadata !== null) {
      const meta = eventMetadata as Record<string, unknown>;

      // Trusted Device metadata
      if (meta['trustedDevice'] !== null && meta['trustedDevice'] !== undefined) {
        fields.push({
          label: 'Trusted Device',
          value: meta['trustedDevice'] ? 'Yes' : 'No',
        });
      }

      // MFA Bypassed metadata
      if (meta['mfaBypassed'] !== null && meta['mfaBypassed'] !== undefined) {
        fields.push({
          label: 'MFA Bypassed',
          value: meta['mfaBypassed'] ? 'Yes' : 'No',
        });
      }

      // MFA Method metadata (if not already shown)
      if (
        meta['mfaMethod'] &&
        typeof meta['mfaMethod'] === 'string' &&
        (!authMethod ||
          String(authMethod).toUpperCase() !== String(meta['mfaMethod']).toUpperCase())
      ) {
        const mfaMethodFormatted = this.formatMFAMethod(meta['mfaMethod']);
        fields.push({ label: 'MFA Method', value: mfaMethodFormatted });
      }

      // Provider metadata (for social login)
      if (meta['provider'] && typeof meta['provider'] === 'string') {
        fields.push({ label: 'Provider', value: String(meta['provider']) });
      }

      // Field changes metadata (for profile updates)
      if (meta['fieldChanges'] && typeof meta['fieldChanges'] === 'object') {
        const fieldChangesStr = JSON.stringify(meta['fieldChanges'], null, 2);
        fields.push({ label: 'Field Changes', value: fieldChangesStr });
      }

      // Device token metadata
      if (meta['deviceTokenProvided'] !== null && meta['deviceTokenProvided'] !== undefined) {
        fields.push({
          label: 'Device Token Provided',
          value: meta['deviceTokenProvided'] ? 'Yes' : 'No',
        });
      }

      if (meta['deviceTokenLength'] !== null && meta['deviceTokenLength'] !== undefined) {
        fields.push({
          label: 'Device Token Length',
          value: String(meta['deviceTokenLength']),
        });
      }

      // Action metadata
      if (meta['action'] && typeof meta['action'] === 'string') {
        fields.push({ label: 'Action', value: String(meta['action']) });
      }

      // Detected at metadata
      if (meta['detectedAt'] && typeof meta['detectedAt'] === 'string') {
        fields.push({
          label: 'Detected At',
          value: this.formatDate(meta['detectedAt']),
        });
      }

      // Verification metadata
      if (meta['verificationTokenId'] !== null && meta['verificationTokenId'] !== undefined) {
        fields.push({
          label: 'Verification Token ID',
          value: String(meta['verificationTokenId']),
        });
      }

      if (meta['verificationMethod'] && typeof meta['verificationMethod'] === 'string') {
        fields.push({
          label: 'Verification Method',
          value: String(meta['verificationMethod']),
        });
      }

      // Challenge metadata
      if (meta['challengeName'] && typeof meta['challengeName'] === 'string') {
        fields.push({ label: 'Challenge Name', value: String(meta['challengeName']) });
      }

      // Any remaining metadata fields as JSON (fallback for unknown fields)
      const knownFields = new Set([
        'trustedDevice',
        'mfaBypassed',
        'mfaMethod',
        'provider',
        'fieldChanges',
        'deviceTokenProvided',
        'deviceTokenLength',
        'action',
        'detectedAt',
        'verificationTokenId',
        'verificationMethod',
        'challengeName',
      ]);
      const remainingFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(meta)) {
        if (!knownFields.has(key)) {
          remainingFields[key] = value;
        }
      }
      if (Object.keys(remainingFields).length > 0) {
        const remainingStr = JSON.stringify(remainingFields, null, 2);
        fields.push({ label: 'Additional Metadata', value: remainingStr });
      }

      // If no individual fields were extracted but metadata exists, show it as JSON
      const hasKnownFields = Array.from(knownFields).some(
        (field: string) => meta[field] !== undefined,
      );
      if (!hasKnownFields && Object.keys(meta).length > 0) {
        const metadataStr = JSON.stringify(meta, null, 2);
        fields.push({ label: 'Metadata', value: metadataStr });
      }
    }

    return fields;
  }

  /**
   * Format metadata value for display
   *
   * @param label - Field label
   * @param value - Field value
   * @returns Formatted string or structured object
   */
  formatMetadataValue(label: string, value: string): string {
    if (label === 'Metadata') {
      try {
        const parsed = JSON.parse(value);
        // Enhance formatting for PROFILE_UPDATED events with fieldChanges
        if (parsed && typeof parsed === 'object' && parsed.fieldChanges) {
          // Format fieldChanges in a more readable way
          const formatted = { ...parsed };
          // Keep fieldChanges as-is (already structured nicely)
          return JSON.stringify(formatted, null, 2);
        }
        return JSON.stringify(parsed, null, 2);
      } catch {
        return value;
      }
    }
    return value;
  }

  /**
   * Check if field value is JSON
   *
   * @param value - Field value
   * @returns True if value is valid JSON
   */
  isJson(value: string): boolean {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if event has additional metadata
   *
   * @param event - Event object
   * @returns True if event has metadata to show
   */
  hasMetadata(event: Record<string, unknown>): boolean {
    return this.getPreviewFields(event).length > 0;
  }
}

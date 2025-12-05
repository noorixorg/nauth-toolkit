import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { User, UpdateProfileRequest } from '../../models/auth.models';

/**
 * Profile Edit Component
 *
 * Allows users to edit their profile information
 */
@Component({
  selector: 'app-profile-edit',
  templateUrl: './profile-edit.component.html',
  styleUrls: ['./profile-edit.component.scss'],
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  standalone: true,
})
export class ProfileEditComponent implements OnInit {
  profileForm!: FormGroup;
  user: User | null = null;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    // E.164 format: +[country code][number] (e.g., +1234567890)
    const phonePattern = /^\+?[1-9]\d{1,14}$/;

    this.profileForm = this.fb.group({
      firstName: [''],
      lastName: [''],
      email: ['', [Validators.required, Validators.email]],
      phone: [
        '',
        [
          Validators.pattern(phonePattern),
          // Custom validator to ensure phone starts with +
          (control: { value: string | null }) => {
            if (!control.value) return null; // Optional field
            const value = control.value.trim();
            if (value && !value.startsWith('+')) {
              return { phoneFormat: { message: 'Phone must start with + (E.164 format)' } };
            }
            return null;
          },
        ],
      ],
    });
  }

  ngOnInit(): void {
    this.loadUserProfile();
  }

  /**
   * Load current user profile
   */
  loadUserProfile(): void {
    this.user = this.authService.getCurrentUser();

    if (!this.user) {
      this.router.navigate(['/login']);
      return;
    }

    // Populate form with current user data
    this.profileForm.patchValue({
      firstName: this.user.firstName || '',
      lastName: this.user.lastName || '',
      email: this.user.email || '',
      phone: this.user.phone || '',
    });
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (this.profileForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const formValue = this.profileForm.value;
      const request: UpdateProfileRequest = {
        firstName: formValue.firstName || undefined,
        lastName: formValue.lastName || undefined,
        email: formValue.email,
        phone: formValue.phone?.trim() || undefined, // Trim whitespace and convert empty string to undefined
      };

      this.authService.updateProfile(request).subscribe({
        next: (updatedUser) => {
          this.user = updatedUser;
          this.successMessage = 'Profile updated successfully!';
          this.isLoading = false;
          setTimeout(() => (this.successMessage = ''), 3000);
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Failed to update profile';
          this.isLoading = false;
        },
      });
    }
  }

  /**
   * Cancel editing and go back to dashboard
   */
  cancel(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Get form controls for template access
   */
  get formControls() {
    return this.profileForm.controls;
  }
}

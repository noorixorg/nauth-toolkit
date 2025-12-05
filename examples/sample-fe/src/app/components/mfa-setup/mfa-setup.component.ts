import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AuthChallengeResponse } from '../../models/auth.models';
import { MFASetupContentComponent } from '../shared/mfa-setup-content/mfa-setup-content.component';
import { MFADeviceMethod } from '../../types/mfa.types';

/**
 * MFA Setup Component (Page Mode)
 *
 * Page component that wraps the unified MFA setup content for login/signup flow.
 * This component handles routing and challenge session management.
 */
@Component({
  selector: 'app-mfa-setup',
  templateUrl: './mfa-setup.component.html',
  styleUrls: ['./mfa-setup.component.scss'],
  imports: [CommonModule, RouterModule, MFASetupContentComponent],
  standalone: true,
})
export class MFASetupComponent implements OnInit {
  challengeSession: AuthChallengeResponse | null = null;
  setupCompleted = false;

  constructor(
    private authService: AuthService,
    public router: Router,
  ) {}

  ngOnInit(): void {
    // Check for stored challenge
    const challenge = this.authService.getStoredChallenge();
    if (!challenge || challenge.challengeName !== 'MFA_SETUP_REQUIRED') {
      // No challenge or wrong challenge - redirect to login
      this.router.navigate(['/login']);
      return;
    }

    this.challengeSession = challenge;
  }

  /**
   * Handle MFA setup completion
   */
  onSetupCompleted(_event: { method: MFADeviceMethod; backupCodes?: string[] }): void {
    this.setupCompleted = true;
    // Navigation is handled by the unified component
  }
}

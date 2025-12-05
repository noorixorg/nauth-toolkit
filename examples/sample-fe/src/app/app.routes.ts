import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { VerifyEmailComponent } from './components/verify-email/verify-email.component';
import { VerifyPhoneComponent } from './components/verify-phone/verify-phone.component';
import { ForceChangePasswordComponent } from './components/force-change-password/force-change-password.component';
import { ProfileEditComponent } from './components/profile-edit/profile-edit.component';
import { AuthGuard } from './services/auth.guard';
import { OAuthCallbackComponent } from './components/oauth-callback/oauth-callback.component';
import { MFASetupComponent } from './components/mfa-setup/mfa-setup.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'auth/callback', component: OAuthCallbackComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'profile', component: ProfileEditComponent, canActivate: [AuthGuard] },
  { path: 'verify-email', component: VerifyEmailComponent },
  { path: 'verify-phone', component: VerifyPhoneComponent },
  { path: 'mfa-setup', component: MFASetupComponent },
  { path: 'force-change-password', component: ForceChangePasswordComponent },
  { path: '**', redirectTo: '/login' },
];

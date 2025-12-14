import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileComponent } from './profile.component';
import { AuthService } from '@nauth-toolkit/client/angular';
import { of, throwError } from 'rxjs';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    // Create mock AuthService
    mockAuthService = jasmine.createSpyObj('AuthService', ['getClient']);
    const mockClient = {
      getProfile: jasmine.createSpy('getProfile').and.returnValue(
        Promise.resolve({
          sub: 'test-sub',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          phone: '+14155552671',
          isEmailVerified: true,
          isPhoneVerified: true,
          hasPasswordHash: true,
          createdAt: new Date().toISOString(),
        }),
      ),
      updateProfile: jasmine.createSpy('updateProfile').and.returnValue(Promise.resolve({})),
    };
    mockAuthService.getClient.and.returnValue(mockClient as any);

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load profile on init', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockAuthService.getClient).toHaveBeenCalled();
    expect(component.user()).toBeTruthy();
    expect(component.loading()).toBe(false);
  });

  it('should enable edit mode', () => {
    component.enableEdit();
    expect(component.editMode()).toBe(true);
  });

  it('should cancel edit mode', () => {
    component.enableEdit();
    component.cancelEdit();
    expect(component.editMode()).toBe(false);
  });

  it('should compute user initials correctly', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const initials = component.userInitials();
    expect(initials).toBe('TU'); // Test User
  });

  it('should validate form on save', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component.enableEdit();
    component.profileForm.patchValue({ email: 'invalid-email' });

    await component.saveProfile();

    // Form should be invalid, profile should not be updated
    expect(component.updating()).toBe(false);
  });
});






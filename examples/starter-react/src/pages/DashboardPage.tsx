import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  return (
    <div className="dashboard-layout">
      <header className="dashboard-header">
        <span className="dashboard-brand">nauth</span>
        <button type="button" className="btn-outline" onClick={handleLogout}>
          Sign out
        </button>
      </header>

      <main className="dashboard-main">
        <div className="profile-card">
          <div className="profile-avatar">{initials}</div>

          <h2>{fullName || 'Your Profile'}</h2>
          <p className="profile-email">{user?.email}</p>

          <div className="profile-details">
            <div className="detail-row">
              <span className="detail-label">Email</span>
              <span className="detail-value">{user?.email}</span>
              <span className={user?.isEmailVerified ? 'badge-success' : 'badge-neutral'}>
                {user?.isEmailVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>

            {user?.phone && (
              <div className="detail-row">
                <span className="detail-label">Phone</span>
                <span className="detail-value">{user.phone}</span>
                <span className={user.isPhoneVerified ? 'badge-success' : 'badge-neutral'}>
                  {user.isPhoneVerified ? 'Verified' : 'Unverified'}
                </span>
              </div>
            )}

            {user?.socialProviders && user.socialProviders.length > 0 && (
              <div className="detail-row">
                <span className="detail-label">Linked</span>
                <span className="detail-value">
                  {user.socialProviders.join(', ')}
                </span>
              </div>
            )}

            <div className="detail-row">
              <span className="detail-label">MFA</span>
              <span className={user?.mfaEnabled ? 'badge-success' : 'badge-neutral'}>
                {user?.mfaEnabled ? 'Enabled' : 'Not enabled'}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Member since</span>
              <span className="detail-value">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

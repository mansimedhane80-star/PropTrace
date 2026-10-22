import BrandHeader from "../../components/BrandHeader";

function Settings({ onBack }) {
  return (
    <div className="settings-page">
      <BrandHeader />

      <div className="settings-card">

        <button className="back-button" onClick={onBack}>
          ← Back to Dashboard
        </button>

        <h1>Settings</h1>

        <p>Manage your PropTrace account settings.</p>

        <div className="settings-item">
          <span>👤</span>
          <div>
            <h3>Account Settings</h3>
            <p>Manage your account information.</p>
          </div>
        </div>

        <div className="settings-item">
          <span>🔔</span>
          <div>
            <h3>Notifications</h3>
            <p>Notification preferences will appear here.</p>
          </div>
        </div>

        <div className="settings-item">
          <span>🔒</span>
          <div>
            <h3>Security</h3>
            <p>Password and security options will appear here.</p>
          </div>
        </div>

      </div>

    </div>
  );
}

export default Settings;

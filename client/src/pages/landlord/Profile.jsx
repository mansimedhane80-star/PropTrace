
import { useEffect, useState } from "react";
import API_URL from "../../services/api";
import BrandHeader from "../../components/BrandHeader";

function Profile({ user: initialUser }) {
  const token = localStorage.getItem("token");
  const [user, setUser] = useState(initialUser || {});
  const [name, setName] = useState(initialUser?.name || "");
  const [email, setEmail] = useState(initialUser?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch(API_URL + "/auth/profile", { headers: { Authorization: "Bearer " + token } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not load profile."); if (active) { setUser(data.user); setName(data.user.name || ""); setEmail(data.user.email || ""); localStorage.setItem("user", JSON.stringify(data.user)); } })
      .catch((loadError) => { if (active) setError(loadError.message || "Could not load profile."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const saveProfile = async (event) => {
    event.preventDefault(); setError(""); setMessage(""); setSaving(true);
    try {
      const response = await fetch(API_URL + "/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ name, email }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not update profile.");
      setUser(data.user); localStorage.setItem("user", JSON.stringify(data.user)); setMessage(data.message || "Profile updated.");
    } catch (saveError) { setError(saveError.message || "Could not update profile."); }
    finally { setSaving(false); }
  };

  const changePassword = async (event) => {
    event.preventDefault(); setError(""); setMessage("");
    if (newPassword !== confirmPassword) { setError("The new password and confirmation do not match."); return; }
    setSaving(true);
    try {
      const response = await fetch(API_URL + "/auth/change-password", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Could not change password.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setMessage(data.message || "Password changed.");
    } catch (passwordError) { setError(passwordError.message || "Could not change password."); }
    finally { setSaving(false); }
  };

  return (
    <div className="profile-page">
      <BrandHeader />
      <main className="account-page-main">
        <header className="account-page-heading">
          <div className="profile-avatar">{(user?.name || "P").charAt(0).toUpperCase()}</div>
          <div>
            <p className="properties-eyebrow">ACCOUNT SETTINGS</p>
            <h1>{user?.name || "Your profile"}</h1>
            <p>Manage your contact details and account security.</p>
          </div>
          <span className="account-role-pill">{user?.role === "tenant" ? "Tenant" : "Landlord"}</span>
        </header>
        {error && <div className="properties-alert properties-alert-error" role="alert">{error}</div>}
        {message && <div className="properties-alert properties-alert-success" role="status">{message}</div>}
        {loading ? <p role="status">Loading your account…</p> : (
          <div className="account-settings-grid">
            <form className="account-settings-card" onSubmit={saveProfile}>
              <div className="account-card-heading"><span className="account-card-icon">◉</span><div><h2>Profile details</h2><p>Your email is used for sign-in and password recovery.</p></div></div>
              <label className="properties-field">Full name<input autoComplete="name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} required /></label>
              <label className="properties-field">Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <button className="properties-primary-button" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
            </form>
            <form className="account-settings-card" onSubmit={changePassword}>
              <div className="account-card-heading"><span className="account-card-icon">⌑</span><div><h2>Change password</h2><p>Use at least 8 characters. Your current password is required.</p></div></div>
              <label className="properties-field">Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
              <label className="properties-field">New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
              <label className="properties-field">Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
              <button className="properties-primary-button" disabled={saving}>{saving ? "Saving…" : "Update password"}</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default Profile;

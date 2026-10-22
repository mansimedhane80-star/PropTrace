import { useState } from "react";
import API_URL from "../../services/api";
import Logo from "../../Logo";
import Button from "../../components/Button";

function ResetPassword({ token, onLogin }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  const submit = async (event) => {
    event.preventDefault(); setMessage(""); setError("");
    if (!token) { setError("This password reset link is missing its token. Request a new link."); return; }
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      const response = await fetch(API_URL + "/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, newPassword: password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not reset password.");
      setMessage(data.message || "Password reset. You can now sign in."); setComplete(true);
    } catch (resetError) { setError(resetError.message || "Could not reset password."); }
    finally { setSaving(false); }
  };

  return <div className="login-page"><div className="login-container"><div className="login-branding"><Logo variant="compact" /><p className="brand-tagline">Record. Compare. Trust.</p><p className="brand-description">Choose a new secure password for your PropTrace account.</p></div><section className="login-card"><div className="login-title"><h2>Create a new password</h2><p>Use at least 8 characters.</p></div>{error && <div className="login-message" role="alert">{error}</div>}{message && <div className="login-message" role="status">{message}</div>}{!complete && <form onSubmit={submit}><label className="input-group"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label className="input-group"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Reset password"}</Button></form>}{complete && <Button type="button" onClick={onLogin}>Return to login</Button>}</section></div></div>;
}

export default ResetPassword;

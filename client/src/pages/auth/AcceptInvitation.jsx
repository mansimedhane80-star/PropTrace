
import { useEffect, useState } from "react";
import API_URL from "../../services/api";
import BrandHeader from "../../components/BrandHeader";

function AcceptInvitation({ token, onBackToLogin, onRegistrationSuccess }) {
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState(token ? "" : "Invitation token is missing");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const verifyInvitation = async () => {
      try {
        const response = await fetch(
          `${API_URL}/invitations/verify/${token}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Invalid invitation");
        }

        setInvitation(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      verifyInvitation();
    }
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email: invitation.tenantEmail,
          password,
          role: "tenant",
          invitationToken: token,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      onRegistrationSuccess?.();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <><BrandHeader /><p>Checking invitation...</p></>;
  }

  if (!invitation) {
    return (
      <><BrandHeader /><div className="auth-container">
          <h2>Invitation unavailable</h2>
          <p>{error}</p>
          <button onClick={onBackToLogin}>Back to login</button>
        </div></>
    );
  }

  return (
    <><BrandHeader /><div className="auth-container">
      <h2>Join PropTrace</h2>
      <p>You have been invited to join a property on PropTrace.</p>
      <p>
        <strong>Invited email:</strong> {invitation.tenantEmail}
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="tenant-name">Full name</label>
        <input
          id="tenant-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        <label htmlFor="tenant-password">Password</label>
        <input
          id="tenant-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />

        <label htmlFor="tenant-confirm-password">Confirm password</label>
        <input
          id="tenant-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
          required
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit">Accept invitation and register</button>
      </form>
    </div></>
  );
}

export default AcceptInvitation;

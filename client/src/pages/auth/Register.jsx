import { useState } from "react";
import Input from "../../components/Input";
import Button from "../../components/Button";
import API_URL from "../../services/api";
import Logo from "../../Logo";

function Register({ onLogin }) {
  const [role, setRole] = useState("landlord");
  const [invitationToken, setInvitationToken] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");

    if (formData.password !== formData.confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role,
          ...(role === "tenant" ? { invitationToken: invitationToken.trim() } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Registration failed");
        setLoading(false);
        return;
      }

      setMessage("Registration successful! You can now login.");

      setFormData({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      });

    } catch (error) {
      setMessage("Unable to connect to server");
      console.error(error);
    }

    setLoading(false);
  };

  return (
    <div className="register-page">

      <div className="background-circle circle-one"></div>
      <div className="background-circle circle-two"></div>

      <div className="register-container">

        {/* Branding */}

        <div className="register-branding">

          <Logo variant="compact" />

          <p className="brand-tagline">
            Record. Compare. Trust.
          </p>

          <p className="brand-description">
            Create your landlord account and start managing
            your rental properties with organized digital records.
          </p>

        </div>

        {/* Registration Card */}

        <div className="register-card">

          <div className="register-title">
            <h2>Create your account</h2>
            <p>Create a tenant or landlord account</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="role-section">
              <label>Account type</label>
              <div className="role-options">
                {["landlord", "tenant"].map((accountRole) => <button key={accountRole} type="button" className={`role-card ${role === accountRole ? "selected" : ""}`} onClick={() => setRole(accountRole)}>{accountRole === "landlord" ? "🏠 Landlord" : "👤 Tenant"}</button>)}
              </div>
            </div>
            {role === "tenant" && <Input label="Invitation token" type="text" name="invitationToken" value={invitationToken} onChange={(event) => setInvitationToken(event.target.value)} placeholder="Enter the token from your invite link" />}

            <Input
              label="Full Name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
            />

            <Input
              label="Email Address"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
            />

            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
            />

            <Input
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
            />

            {message && (
              <div className="register-message">
                {message}
              </div>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>

          </form>

          <div className="register-footer">
            <p>
              Already have an account?{" "}
              <span className="login-link" onClick={onLogin}>
  Login
</span>
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}

export default Register;

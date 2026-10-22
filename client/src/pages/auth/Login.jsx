import { useState } from "react";
import Input from "../../components/Input";
import Button from "../../components/Button";
import API_URL from "../../services/api";
import Logo from "../../Logo";
function Login({ onRegister, onLoginSuccess }) {
  const [role, setRole] = useState("landlord");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setMessage("Login successful!");

onLoginSuccess(data.user);

    } catch (error) {
      setMessage("Unable to connect to server");
      console.error(error);
    }

    setLoading(false);
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!formData.email.trim()) { setMessage("Enter the email address on your account."); return; }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not request a password reset.");
      setMessage(data.message || "If an account uses this email, a password reset link will be sent.");
    } catch (error) {
      setMessage(error.message || "Could not connect to the password reset service.");
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">

      <div className="background-circle circle-one"></div>
      <div className="background-circle circle-two"></div>

      <div className="login-container">

        {/* Branding Side */}
        <div className="login-branding">

          <Logo variant="compact" />

          <p className="brand-tagline">
  Record. Compare. Trust.
</p>

          <p className="brand-description">
            Keep your rental property's condition, inspections,
            maintenance and handover records organized in one secure place.
          </p>

          <div className="brand-feature">
            <span>✓</span>
            <p>Track property condition</p>
          </div>

          <div className="brand-feature">
            <span>✓</span>
            <p>Keep inspection evidence organized</p>
          </div>

          <div className="brand-feature">
            <span>✓</span>
            <p>Make handovers easier</p>
          </div>

        </div>

        {/* Login Card */}
        <div className="login-card">

          <div className="login-title">
            <h2>{forgotMode ? "Reset your password" : "Welcome back"}</h2>
            <p>{forgotMode ? "We’ll email you a secure link to choose a new password." : "Sign in to continue to PropTrace"}</p>
          </div>

          <form onSubmit={forgotMode ? handleForgotPassword : handleSubmit}>

            {!forgotMode && <div className="role-section">
              <label>Continue as</label>

              <div className="role-options">

                <button
                  type="button"
                  className={`role-card ${
                    role === "landlord" ? "selected" : ""
                  }`}
                  onClick={() => setRole("landlord")}
                >
                  <span className="role-icon">🏠</span>
                  <span>Landlord</span>
                </button>

                <button
                  type="button"
                  className={`role-card ${
                    role === "tenant" ? "selected" : ""
                  }`}
                  onClick={() => setRole("tenant")}
                >
                  <span className="role-icon">👤</span>
                  <span>Tenant</span>
                </button>

              </div>
            </div>}

            <Input
              label="Email Address"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
            />

            {!forgotMode && <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
            />}

            {!forgotMode && <button className="forgot-password" type="button" onClick={() => { setForgotMode(true); setMessage(""); }}>Forgot password?</button>}
            {forgotMode && <p className="forgot-password-help">If the email matches an account, we’ll send a reset link. Check your spam folder if it doesn’t arrive.</p>}

            {message && (
              <div className="login-message">
                {message}
              </div>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? (forgotMode ? "Sending link..." : "Logging in...") : (forgotMode ? "Send reset link" : "Login")}
            </Button>

          </form>

          <div className="login-footer">
            <p>
              {forgotMode ? <button className="register-link register-link-button" type="button" onClick={() => { setForgotMode(false); setMessage(""); }}>Back to login</button> : <>Don&apos;t have an account?{" "}<span className="register-link" role="button" tabIndex={0} onClick={onRegister}>Create an account</span></>}
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}

export default Login;

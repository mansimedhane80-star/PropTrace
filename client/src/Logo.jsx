
import logo from "./assets/proptrace-logo.png";

function Logo({ className = "", variant = "full" }) {
  return (
    <div
      className={`proptrace-logo proptrace-logo-${variant} ${className}`}
    >
      <img
        src={logo}
        alt="PropTrace"
        className="proptrace-logo-image"
      />
    </div>
  );
}

export default Logo;

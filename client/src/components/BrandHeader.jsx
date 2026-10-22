
import Logo from "../Logo";

function BrandHeader() {
  return (
    <header className="brand-header">
      <Logo variant="compact" />
      <span className="brand-tagline">
        Record. Compare. Trust.
      </span>
    </header>
  );
}

export default BrandHeader;

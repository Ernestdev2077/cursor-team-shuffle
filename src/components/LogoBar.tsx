interface LogoBarProps {
  logos: string[];
  onRemove: (index: number) => void;
}

// Row of event logos shown at the top of every screen.
export default function LogoBar({ logos, onRemove }: LogoBarProps) {
  return (
    <div className="cht-logos">
      {logos.map((logo, i) => (
        <div key={i} className="cht-logo-group">
          {i > 0 && <div className="cht-logo-divider" />}
          <div className="cht-logo-wrap">
            <img src={logo} alt={`Logo ${i + 1}`} />
            {logos.length > 1 && (
              <button className="cht-logo-remove" onClick={() => onRemove(i)} title="Remove logo">
                ×
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

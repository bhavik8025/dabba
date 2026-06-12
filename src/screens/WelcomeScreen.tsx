import { enterDemo } from "../lib/demo";

interface Props {
  onLogin: () => void;
}

// First thing a logged-out visitor sees on the live site — the 10-second pitch.
export default function WelcomeScreen({ onLogin }: Props) {
  return (
    <div className="screen no-tabs">
      <div className="hero">
        <img className="logo" src="/icon.svg" alt="" />
        <h1>Dabba</h1>
        <p>One friend pays the tiffin wala. Everyone settles. Zero fights.</p>
      </div>

      <div className="card">
        <div className="welcome-point">🍱 Log the day in 10 seconds — who ordered, who paid</div>
        <div className="welcome-point">➗ Shared tiffins split exact to the paisa</div>
        <div className="welcome-point">🔍 Every add, edit & delete is signed — nobody can cheat</div>
        <div className="welcome-point">📲 Month-end report, one tap to WhatsApp</div>
      </div>

      <button className="btn" onClick={onLogin}>Log in / Create account</button>
      <div style={{ height: 10 }} />
      <button className="btn secondary" onClick={enterDemo}>
        👀 Try the demo first — no signup
      </button>
      <p className="hint" style={{ textAlign: "center", marginTop: 14 }}>
        Free for your group · works on any phone · installs from this page
      </p>
    </div>
  );
}

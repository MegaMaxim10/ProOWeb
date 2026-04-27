function buildFrontendAuthenticationWorkbenchJsx(options = {}) {
  const externalIamEnabled = Boolean(options.externalIamEnabled);
  const defaultProviderId = options.externalIamProviderId || "corporate-oidc";
  const externalSection = externalIamEnabled
    ? `
        <form className="auth-box auth-form" onSubmit={onExternalLogin}>
          <h3>8. External IAM Login (OIDC)</h3>
          <input
            value={externalProviderId}
            onChange={(event) => setExternalProviderId(event.target.value)}
            placeholder="Provider ID"
            required
          />
          <textarea
            value={externalIdToken}
            onChange={(event) => setExternalIdToken(event.target.value)}
            placeholder="OIDC ID token (JWT)"
            rows={4}
            required
          />
          <button type="submit" disabled={loading}>Authenticate with external IAM</button>
        </form>`
    : "";

  return `import { useState } from "react";
import { useAuthFlows } from "./useAuthFlows";

export function AuthenticationWorkbench() {
  const {
    loading,
    error,
    result,
    basicAuth,
    setBasicAuth,
    registerAccount,
    activateAccount,
    login,
    requestPasswordReset,
    confirmPasswordReset,
    setupOtpMfa,
    setupTotpMfa,
    externalOidcLogin,
  } = useAuthFlows();

  const [displayName, setDisplayName] = useState("Alice Tester");
  const [email, setEmail] = useState("alice@example.com");
  const [username, setUsername] = useState("alice");
  const [password, setPassword] = useState("Password123!");
  const [activationToken, setActivationToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [resetPrincipal, setResetPrincipal] = useState("alice");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("NewPassword123!");
  const [externalProviderId, setExternalProviderId] = useState(${JSON.stringify(defaultProviderId)});
  const [externalIdToken, setExternalIdToken] = useState("");

  async function onRegister(event) {
    event.preventDefault();
    const payload = await registerAccount({
      displayName,
      email,
      username,
      password,
    });

    if (payload.activationToken) {
      setActivationToken(payload.activationToken);
    }
  }

  async function onActivate(event) {
    event.preventDefault();
    await activateAccount({ activationToken });
  }

  async function onLogin(event) {
    event.preventDefault();
    await login({ username, password, mfaCode });
  }

  async function onRequestReset(event) {
    event.preventDefault();
    const payload = await requestPasswordReset({ principal: resetPrincipal });
    if (payload.passwordResetToken) {
      setResetToken(payload.passwordResetToken);
    }
  }

  async function onConfirmReset(event) {
    event.preventDefault();
    await confirmPasswordReset({ resetToken, newPassword });
    setPassword(newPassword);
  }

  async function onSetupOtp(event) {
    event.preventDefault();
    const payload = await setupOtpMfa();
    if (payload.otpCode) {
      setMfaCode(payload.otpCode);
    }
  }

  async function onSetupTotp(event) {
    event.preventDefault();
    await setupTotpMfa();
  }

  async function onExternalLogin(event) {
    event.preventDefault();
    await externalOidcLogin({
      providerId: externalProviderId,
      idToken: externalIdToken,
    });
  }

  return (
    <section className="card">
      <p className="eyebrow">Authentication Flows</p>
      <h2>Auth Workbench</h2>
      <p className="muted">
        Register, activate, login, reset password, and configure OTP/TOTP MFA against generated APIs.
      </p>

      <div className="auth-grid">
        <form className="auth-box auth-form" onSubmit={onRegister}>
          <h3>1. Register</h3>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" required />
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" required />
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" required />
          <button type="submit" disabled={loading}>Register account</button>
        </form>

        <form className="auth-box auth-form" onSubmit={onActivate}>
          <h3>2. Activate</h3>
          <input value={activationToken} onChange={(event) => setActivationToken(event.target.value)} placeholder="Activation token" required />
          <button type="submit" disabled={loading}>Activate account</button>
        </form>

        <form className="auth-box auth-form" onSubmit={onLogin}>
          <h3>3. Login</h3>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" required />
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" required />
          <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="MFA code (optional)" />
          <button type="submit" disabled={loading}>Login</button>
        </form>

        <form className="auth-box auth-form" onSubmit={onRequestReset}>
          <h3>4. Request Password Reset</h3>
          <input value={resetPrincipal} onChange={(event) => setResetPrincipal(event.target.value)} placeholder="Username or email" required />
          <button type="submit" disabled={loading}>Request reset token</button>
        </form>

        <form className="auth-box auth-form" onSubmit={onConfirmReset}>
          <h3>5. Confirm Password Reset</h3>
          <input value={resetToken} onChange={(event) => setResetToken(event.target.value)} placeholder="Reset token" required />
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" required />
          <button type="submit" disabled={loading}>Confirm reset</button>
        </form>

        <form className="auth-box auth-form" onSubmit={onSetupOtp}>
          <h3>6. Setup OTP MFA</h3>
          <input
            value={basicAuth.username}
            onChange={(event) => setBasicAuth((previous) => ({ ...previous, username: event.target.value }))}
            placeholder="Basic auth username"
            required
          />
          <input
            type="password"
            value={basicAuth.password}
            onChange={(event) => setBasicAuth((previous) => ({ ...previous, password: event.target.value }))}
            placeholder="Basic auth password"
            required
          />
          <button type="submit" disabled={loading}>Configure OTP</button>
        </form>

        <form className="auth-box auth-form" onSubmit={onSetupTotp}>
          <h3>7. Setup TOTP MFA</h3>
          <input
            value={basicAuth.username}
            onChange={(event) => setBasicAuth((previous) => ({ ...previous, username: event.target.value }))}
            placeholder="Basic auth username"
            required
          />
          <input
            type="password"
            value={basicAuth.password}
            onChange={(event) => setBasicAuth((previous) => ({ ...previous, password: event.target.value }))}
            placeholder="Basic auth password"
            required
          />
          <button type="submit" disabled={loading}>Configure TOTP</button>
        </form>
${externalSection}
      </div>

      {error ? <p className="error">{error}</p> : null}
      {result ? (
        <pre className="auth-result">
{JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
`;
}

module.exports = {
  buildFrontendAuthenticationWorkbenchJsx,
};

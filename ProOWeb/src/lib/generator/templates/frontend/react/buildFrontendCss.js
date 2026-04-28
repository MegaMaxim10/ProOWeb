function buildFrontendCss() {

  return `:root {
  color-scheme: light;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  background: radial-gradient(circle at top right, #e9f4ff 0%, #f7fbff 42%, #ffffff 100%);
  color: #123;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
}

.card {
  width: min(720px, 100%);
  background: #ffffff;
  border: 1px solid #cddceb;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 20px 45px rgba(13, 44, 77, 0.08);
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  color: #355676;
}

h1 {
  margin: 0.75rem 0;
  font-size: clamp(1.8rem, 4vw, 2.6rem);
}

.muted {
  color: #4b647c;
}

.ok {
  color: #0a7c2a;
  font-weight: 700;
}

.warn {
  color: #8c4c00;
  font-weight: 700;
}

.error {
  color: #b42318;
  font-weight: 600;
}

.identity-grid {
  margin-top: 1.25rem;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

.identity-box {
  border: 1px solid #d7e2ee;
  border-radius: 12px;
  background: #fbfdff;
  padding: 0.85rem;
}

.identity-box h3 {
  margin-top: 0;
}

.identity-box label {
  display: block;
  margin-bottom: 0.6rem;
  font-size: 0.92rem;
}

.identity-box input,
.identity-box select,
.identity-box textarea {
  width: 100%;
  border: 1px solid #c4d1de;
  border-radius: 8px;
  padding: 0.42rem 0.55rem;
  font-size: 0.95rem;
}

.identity-box textarea {
  resize: vertical;
}

.identity-box button {
  margin-top: 0.5rem;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  background: #165d95;
  color: #ffffff;
  cursor: pointer;
}

.identity-box button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.identity-form {
  display: grid;
  gap: 0.5rem;
}

.identity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.65rem;
}

.identity-list li {
  border: 1px solid #dce7f2;
  border-radius: 8px;
  padding: 0.55rem 0.65rem;
  display: grid;
  gap: 0.2rem;
}

.identity-list small {
  color: #556f87;
}

.assign-row {
  margin-top: 0.45rem;
  display: flex;
  gap: 0.45rem;
}

.assign-row select {
  flex: 1;
}

.auth-grid {
  margin-top: 1rem;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

.auth-box {
  border: 1px solid #d7e2ee;
  border-radius: 12px;
  background: #fbfdff;
  padding: 0.85rem;
}

.auth-box h3 {
  margin-top: 0;
}

.auth-form {
  display: grid;
  gap: 0.5rem;
}

.auth-form input {
  width: 100%;
  border: 1px solid #c4d1de;
  border-radius: 8px;
  padding: 0.42rem 0.55rem;
  font-size: 0.95rem;
}

.auth-form button {
  border: none;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  background: #1d6f5f;
  color: #ffffff;
  cursor: pointer;
}

.auth-form button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.auth-result {
  margin-top: 0.85rem;
  border-radius: 10px;
  border: 1px solid #dce7f2;
  background: #f7fbff;
  padding: 0.75rem;
  overflow: auto;
}

.runtime-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.45rem;
}

.runtime-actions button {
  margin-top: 0;
}

.runtime-json {
  font-family: "Consolas", "Courier New", monospace;
}

.runtime-timeline {
  margin: 0.75rem 0 0;
  padding-left: 1.05rem;
  display: grid;
  gap: 0.45rem;
}
`;
}

module.exports = {
  buildFrontendCss,
};

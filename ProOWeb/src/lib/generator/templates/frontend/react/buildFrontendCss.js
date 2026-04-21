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
`;
}

module.exports = {
  buildFrontendCss,
};

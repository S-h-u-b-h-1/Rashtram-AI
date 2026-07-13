const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  validateAccountDeletionRequest,
} = require("../profile/profileService");

const repositoryRoot = path.join(__dirname, "..", "..");
const read = (...parts) =>
  fs.readFileSync(path.join(repositoryRoot, ...parts), "utf8");

test("Google sign-in remains rendered and uses server-reported availability", () => {
  const component = read(
    "client",
    "src",
    "components",
    "auth",
    "GoogleSignInButton.jsx",
  );
  const login = read("client", "src", "app", "login", "page.js");
  const signup = read("client", "src", "app", "signup", "page.js");
  const route = read("server", "auth", "route.js");

  assert.match(component, /Continue with Google/);
  assert.match(component, /getAuthCapabilities/);
  assert.match(component, /disabled=\{disabled \|\| unavailable\}/);
  assert.match(login, /<GoogleSignInButton/);
  assert.match(signup, /<GoogleSignInButton/);
  assert.match(route, /router\.get\('\/capabilities'/);
  assert.match(route, /enabled: googleConfigured/);
});

test("application shells constrain viewport overflow without blocking content scrolling", () => {
  const styles = read("client", "src", "app", "globals.css");
  const workspace = read(
    "client",
    "src",
    "components",
    "workspace",
    "WorkspaceShell.jsx",
  );
  const authShell = read(
    "client",
    "src",
    "components",
    "AuthShell.jsx",
  );

  assert.match(styles, /html \{[\s\S]*height: 100%/);
  assert.match(styles, /body \{[\s\S]*min-height: 100%/);
  assert.match(workspace, /h-svh[\s\S]*supports-\[height:100dvh\]:h-dvh/);
  assert.match(workspace, /overflow-y-auto overflow-x-hidden/);
  assert.match(authShell, /min-h-svh w-full overflow-x-clip/);
});

test("profile exposes responsive sections and reliable database-backed stats", () => {
  const profileView = read(
    "client",
    "src",
    "components",
    "profile",
    "ProfileView.jsx",
  );
  const activity = read(
    "client",
    "src",
    "components",
    "profile",
    "ResearchActivity.jsx",
  );
  const service = read("server", "profile", "profileService.js");

  for (const id of [
    "research-activity",
    "recent-research",
    "account-settings",
    "privacy-settings",
  ]) {
    assert.match(profileView, new RegExp(id));
  }
  assert.match(profileView, /grid gap-5 xl:grid-cols-2/);
  assert.match(activity, /Documents opened/);
  assert.match(activity, /Policies opened/);
  assert.match(activity, /Research sessions/);
  assert.match(activity, /Research notes/);
  assert.match(activity, /Comparisons/);
  assert.match(service, /AS policies_opened/);
  assert.match(service, /AS comparisons_created/);
  assert.match(service, /AS notes_created/);
});

test("account deletion requires exact confirmation and password where applicable", () => {
  assert.throws(
    () => validateAccountDeletionRequest({ confirmation: "delete" }),
    /Type DELETE/,
  );
  assert.throws(
    () => validateAccountDeletionRequest({ confirmation: "DELETE" }, true),
    /Current password is required/,
  );
  assert.deepEqual(
    validateAccountDeletionRequest(
      { confirmation: " DELETE ", password: "current-password" },
      true,
    ),
    { confirmation: "DELETE", password: "current-password" },
  );
  assert.deepEqual(
    validateAccountDeletionRequest({ confirmation: "DELETE" }, false),
    { confirmation: "DELETE", password: "" },
  );
});

test("profile update route remains authenticated and bounded by sanitizers", () => {
  const route = read("server", "profile", "route.js");
  const service = read("server", "profile", "profileService.js");

  assert.match(route, /router\.patch\("\/", fetchuser/);
  assert.match(route, /router\.delete\("\/", fetchuser/);
  assert.match(service, /const name = text\(payload\.name, 120\)/);
  assert.match(service, /Username must be 3–40 letters/);
  assert.match(service, /BEGIN/);
  assert.match(service, /ROLLBACK/);
  assert.match(service, /DELETE FROM users/);
});

test("local UI verification can use alternate ports without widening production CORS", () => {
  const server = read("server", "server.js");
  assert.match(server, /process\.env\.NODE_ENV !== "production"/);
  assert.match(server, /localhost\|127\\\.0\\\.0\\\.1/);
  assert.match(server, /isLocalDevelopmentOrigin/);
});

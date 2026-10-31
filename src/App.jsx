import { useCallback, useEffect, useMemo, useState } from "react";
import "./styles.css";

const API = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const ROLE_META = {
  PATIENT: { label: "Patient", icon: "♡", subtitle: "Your care, organized" },
  DOCTOR: { label: "Doctor", icon: "✚", subtitle: "Your clinical workspace" },
  ADMIN: { label: "Administrator", icon: "⚙", subtitle: "Manage your care team" },
};
const NAV = {
  PATIENT: [
    ["overview", "Overview", "⌂"], ["doctors", "Find doctors", "✚"],
    ["appointments", "Appointments", "▦"], ["records", "Medical records", "▤"],
    ["profile", "My profile", "◉"],
  ],
  DOCTOR: [
    ["overview", "Overview", "⌂"], ["appointments", "Appointments", "▦"],
    ["patients", "My patients", "♧"], ["records", "Medical records", "▤"],
    ["create-record", "New medical record", "+"], ["profile", "My profile", "◉"],
  ],
  ADMIN: [["overview", "Overview", "⌂"], ["create-doctor", "Add a doctor", "+" ]],
};

async function api(path, { token, method = "GET", body, signal } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal,
    });
  } catch {
    throw new Error("Cannot reach the backend. Check that HospitalMS is running on port 8080.");
  }
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = raw; }
  }
  if (!response.ok) {
    let message = typeof data === "string" ? data : data?.message || data?.error || "";
    if (!message) {
      if (response.status === 401) message = "Your session is not authorized. Sign in again.";
      else if (response.status === 403) message = "This account does not have permission for this action. Check the selected role.";
      else if (response.status === 404) message = "The requested resource was not found.";
      else if (response.status === 400) message = "Some information is invalid. Review the fields and try again.";
      else message = `Request failed (${response.status}).`;
    }
    throw new Error(message);
  }
  return data;
}

function pageContent(result) {
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.content) ? result.content : [];
}
function shortId(id) { return id ? `${id.slice(0, 8)}…` : "—"; }
function formatDate(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase() || "").join("") || "HM";
}

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("hospitalms-session") || "null"); } catch { return null; }
  });
  const [authMode, setAuthMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState("overview");
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const saveSession = (next) => {
    sessionStorage.setItem("hospitalms-session", JSON.stringify(next));
    setSession(next);
    setActive("overview");
    setNotice("");
    setAuthError("");
  };
  const logout = () => {
    sessionStorage.removeItem("hospitalms-session");
    setSession(null); setProfile(null); setActive("overview"); setNotice(""); setAuthError("");
  };

  const loadProfile = useCallback(async () => {
    if (!session) return;
    if (session.role === "ADMIN") { setProfile({ name: "Administrator", email: session.email }); return; }
    setProfileLoading(true);
    try {
      const path = session.role === "PATIENT" ? "/patient/profile" : "/doctor/profile";
      const data = await api(path, { token: session.token });
      setProfile({ ...data, email: data.email || session.email });
    } catch (error) {
      setProfile(null);
      setNotice(error.message);
    } finally { setProfileLoading(false); }
  }, [session]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleAuth = async (form) => {
    setBusy(true); setAuthError("");
    try {
      if (authMode === "signup") {
        await api("/auth/signup", { method: "POST", body: { name: form.name.trim(), email: form.email.trim(), password: form.password } });
        setAuthMode("login");
        setAuthError("");
        setNotice("Account created. Sign in with your new patient account.");
      } else {
        const result = await api("/auth/login", { method: "POST", body: { email: form.email.trim(), password: form.password } });
        if (!result?.token) throw new Error("Login succeeded but the API response did not contain a token.");
        saveSession({ token: result.token, email: form.email.trim(), role: form.role });
      }
    } catch (error) { setAuthError(error.message); }
    finally { setBusy(false); }
  };

  const runAction = async (action, successMessage) => {
    setNotice("");
    try {
      await action();
      if (successMessage) setNotice(successMessage);
      return true;
    } catch (error) { setNotice(error.message); return false; }
  };

  if (!session) {
    return <AuthScreen mode={authMode} setMode={(mode) => { setAuthMode(mode); setAuthError(""); setNotice(""); }} onSubmit={handleAuth} busy={busy} error={authError} notice={notice} />;
  }

  const role = session.role;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">H<span>+</span></div>
          <div><strong>HospitalMS</strong><small>CARE MANAGEMENT</small></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          {(NAV[role] || []).map(([key, label, icon]) => (
            <button className={`nav-item ${active === key ? "active" : ""}`} key={key} onClick={() => { setActive(key); setNotice(""); }}>
              <span className="nav-icon">{icon}</span><span>{label}</span>{active === key && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon">✦</span><strong>Care, connected.</strong><p>Your health information in one place.</p></div>
          <button className="nav-item signout" onClick={logout}><span className="nav-icon">↪</span><span>Sign out</span></button>
          <div className="sidebar-version">HospitalMS · Personal care portal</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="crumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{(NAV[role] || []).find(n => n[0] === active)?.[1] || "Overview"}</strong></div>
          <div className="topbar-right">
            <span className="secure-label"><span className="secure-dot" /> Secure session</span>
            <div className="top-user"><div className="avatar">{initials(profile?.name || session.email)}</div><div className="top-user-info"><strong>{profile?.name || session.email}</strong><small>{ROLE_META[role].label}</small></div></div>
          </div>
        </header>
        <section className="page-content">
          {notice && <div className={`notice ${notice.toLowerCase().includes("cannot") || notice.toLowerCase().includes("failed") || notice.includes("permission") || notice.includes("not found") ? "notice-error" : ""}`} role="status"><span>{notice.toLowerCase().includes("created") || notice.toLowerCase().includes("updated") ? "✓" : "i"}</span><div>{notice}</div><button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
          {active === "overview" && <Overview role={role} profile={profile} profileLoading={profileLoading} token={session.token} onNavigate={setActive} onAction={runAction} />}
          {role === "PATIENT" && active === "doctors" && <Doctors token={session.token} onAction={runAction} />}
          {role === "PATIENT" && active === "appointments" && <PatientAppointments token={session.token} onAction={runAction} onNavigate={setActive} />}
          {role === "PATIENT" && active === "records" && <Records token={session.token} endpoint="/medical-records/my" role={role} />}
          {role === "PATIENT" && active === "profile" && <Profile role={role} token={session.token} profile={profile} reload={loadProfile} onAction={runAction} />}
          {role === "DOCTOR" && active === "appointments" && <DoctorAppointments token={session.token} onAction={runAction} />}
          {role === "DOCTOR" && active === "patients" && <DoctorPatients token={session.token} onAction={runAction} onNavigate={setActive} />}
          {role === "DOCTOR" && active === "records" && <Records token={session.token} endpoint="/medical-records/doctor" role={role} />}
          {role === "DOCTOR" && active === "create-record" && <CreateRecord token={session.token} onAction={runAction} />}
          {role === "DOCTOR" && active === "profile" && <Profile role={role} token={session.token} profile={profile} reload={loadProfile} onAction={runAction} />}
          {role === "ADMIN" && active === "create-doctor" && <CreateDoctor token={session.token} onAction={runAction} />}
        </section>
        <footer className="page-footer"><span>HospitalMS <b>·</b> Care management system</span><span>Protected by role-based access</span></footer>
      </main>
    </div>
  );
}

function AuthScreen({ mode, setMode, onSubmit, busy, error, notice }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "PATIENT" });
  const signup = mode === "signup";
  const update = (key, value) => setForm(old => ({ ...old, [key]: value }));
  const submit = (event) => { event.preventDefault(); onSubmit(form); };
  return <div className="auth-layout">
    <section className="auth-art">
      <div className="auth-art-inner">
        <div className="brand brand-light"><div className="brand-mark">H<span>+</span></div><div><strong>HospitalMS</strong><small>CARE MANAGEMENT</small></div></div>
        <div className="art-copy"><span className="eyebrow light-eyebrow">BETTER CARE STARTS HERE</span><h1>Health care,<br /><em>made human.</em></h1><p>A simpler way to manage appointments, connect with your care team, and keep your health information together.</p></div>
        <div className="art-stat-row"><div className="art-stat"><strong>01</strong><span>One care space</span></div><div className="art-stat"><strong>02</strong><span>Connected teams</span></div><div className="art-stat"><strong>03</strong><span>Care that follows you</span></div></div>
        <div className="art-decoration deco-one" /><div className="art-decoration deco-two" />
      </div>
    </section>
    <section className="auth-panel">
      <div className="auth-form-wrap">
        <span className="eyebrow">{signup ? "GET STARTED" : "WELCOME BACK"}</span>
        <h2>{signup ? "Create your account" : "Sign in to HospitalMS"}</h2>
        <p className="auth-subtitle">{signup ? "Set up your patient account in a few steps." : "Enter your details to access your care workspace."}</p>
        {notice && <div className="notice"><span>✓</span><div>{notice}</div></div>}
        {error && <div className="notice notice-error"><span>!</span><div>{error}</div></div>}
        <form onSubmit={submit} className="auth-form">
          {signup && <label>Full name<input autoComplete="name" value={form.name} onChange={e => update("name", e.target.value)} placeholder="Your full name" required maxLength={100} /></label>}
          <label>Email address<div className="input-with-icon"><span>✉</span><input type="email" autoComplete="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="you@example.com" required /></div></label>
          <label>Password<div className="input-with-icon"><span>⌑</span><input type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={6} value={form.password} onChange={e => update("password", e.target.value)} placeholder={signup ? "At least 6 characters" : "Enter your password"} required /></div></label>
          {!signup && <label>Sign in as<select value={form.role} onChange={e => update("role", e.target.value)}><option value="PATIENT">Patient</option><option value="DOCTOR">Doctor</option><option value="ADMIN">Administrator</option></select><span className="field-hint">Choose the role assigned to this account. The backend still enforces permissions.</span></label>}
          {signup && <p className="field-hint signup-hint">Patient registration is open. Doctor accounts are created by an administrator.</p>}
          <button className="primary-button auth-submit" disabled={busy}>{busy ? <><span className="spinner" /> Please wait…</> : signup ? "Create account" : "Sign in"} <span>→</span></button>
        </form>
        <p className="auth-switch">{signup ? "Already have an account?" : "New to HospitalMS?"} <button onClick={() => setMode(signup ? "login" : "signup")}>{signup ? "Sign in" : "Create an account"}</button></p>
        <div className="auth-foot"><span>⌑ Your session is protected</span><span>HospitalMS © 2026</span></div>
      </div>
    </section>
  </div>;
}

function Overview({ role, profile, profileLoading, token, onNavigate, onAction }) {
  const [stats, setStats] = useState({ appointments: 0, records: 0, doctors: 0, patients: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const tasks = role === "PATIENT" ? [
        api("/appointments/my?page=0&size=100", { token }).then(x => ["appointments", pageContent(x).length]),
        api("/medical-records/my?page=0&size=100", { token }).then(x => ["records", pageContent(x).length]),
        api("/doctors", { token }).then(x => ["doctors", Array.isArray(x) ? x.length : 0]),
      ] : role === "DOCTOR" ? [
        api("/doctor/appointments?page=0&size=100", { token }).then(x => ["appointments", pageContent(x).length]),
        api("/medical-records/doctor?page=0&size=100", { token }).then(x => ["records", pageContent(x).length]),
        api("/doctor/patients", { token }).then(x => ["patients", Array.isArray(x) ? x.length : 0]),
      ] : [];
      const results = await Promise.allSettled(tasks);
      if (alive) {
        const next = { appointments: 0, records: 0, doctors: 0, patients: 0 };
        results.forEach(r => { if (r.status === "fulfilled") next[r.value[0]] = r.value[1]; });
        setStats(next); setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [role, token]);
  const name = profile?.name?.trim()?.split(/\s+/)[0] || (role === "ADMIN" ? "Administrator" : "there");
  const tiles = role === "PATIENT" ? [
    { label: "Appointments", value: stats.appointments, note: "Across your care journey", icon: "▦", tint: "blue", action: "appointments" },
    { label: "Medical records", value: stats.records, note: "Your health history", icon: "▤", tint: "mint", action: "records" },
    { label: "Available doctors", value: stats.doctors, note: "Care team directory", icon: "✚", tint: "peach", action: "doctors" },
  ] : role === "DOCTOR" ? [
    { label: "Appointments", value: stats.appointments, note: "Your patient schedule", icon: "▦", tint: "blue", action: "appointments" },
    { label: "My patients", value: stats.patients, note: "Connected through appointments", icon: "♧", tint: "mint", action: "patients" },
    { label: "Records created", value: stats.records, note: "Clinical documentation", icon: "▤", tint: "peach", action: "records" },
  ] : [
    { label: "Doctor management", value: "Ready", note: "Create doctor accounts", icon: "✚", tint: "blue", action: "create-doctor" },
    { label: "Role access", value: "Active", note: "Backend-enforced permissions", icon: "◈", tint: "mint", action: "create-doctor" },
  ];
  return <div className="content-stack">
    <div className="welcome-row"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>{role === "ADMIN" ? "Welcome back." : `Good ${timeGreeting()}, ${name}.`}</h1><p>{ROLE_META[role].subtitle}. Here's what's happening today.</p></div><div className="date-pill"><span>◷</span>{new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</div></div>
    <div className="welcome-banner"><div className="banner-copy"><span className="banner-label">HOSPITALMS · {ROLE_META[role].label.toUpperCase()} PORTAL</span><h2>{role === "PATIENT" ? "Your health, in good hands." : role === "DOCTOR" ? "Every patient. Every detail." : "Build your care team."}</h2><p>{role === "PATIENT" ? "Book appointments and keep your medical information close." : role === "DOCTOR" ? "Manage appointments and maintain clear clinical records." : "Create doctor accounts and keep your team connected."}</p><button className="banner-button" onClick={() => onNavigate(role === "PATIENT" ? "doctors" : role === "DOCTOR" ? "appointments" : "create-doctor")}>{role === "PATIENT" ? "Find a doctor" : role === "DOCTOR" ? "View appointments" : "Add a doctor"} <span>→</span></button></div><div className="banner-art"><div className="art-circle circle-back" /><div className="art-circle circle-front"><span>{role === "PATIENT" ? "♡" : role === "DOCTOR" ? "✚" : "✦"}</span></div><div className="floating-card"><span className="floating-check">✓</span><div><strong>Care connected</strong><small>All in one place</small></div></div></div></div>
    <div className="section-heading"><div><h2>Your snapshot</h2><p>A quick look at your HospitalMS workspace.</p></div><span className="live-label"><i /> {loading ? "Updating" : "Overview"}</span></div>
    <div className="stats-grid">{tiles.map(tile => <button className="stat-card" key={tile.label} onClick={() => onNavigate(tile.action)}><div className="stat-top"><span>{tile.label}</span><span className={`stat-icon ${tile.tint}`}>{tile.icon}</span></div><div className="stat-value">{loading ? "—" : tile.value}</div><div className="stat-note">{tile.note}<span>↗</span></div></button>)}</div>
    <div className="bottom-grid"><div className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Get where you need to go.</p></div><span className="panel-heading-icon">✦</span></div><div className="quick-actions">{(role === "PATIENT" ? [["doctors","Book an appointment","Find the right specialist"],["appointments","My appointments","Review or cancel bookings"],["records","Medical records","Review your care history"]] : role === "DOCTOR" ? [["appointments","Manage appointments","Review and update status"],["create-record","Create a record","Document a patient visit"],["patients","View my patients","See patients with appointments"]] : [["create-doctor","Create a doctor account","Add a clinician to the system"]]).map(([key,title,desc]) => <button className="quick-action" key={key} onClick={() => onNavigate(key)}><span className="quick-action-icon">{key === "doctors" || key === "create-doctor" ? "✚" : key === "appointments" ? "▦" : key === "records" || key === "create-record" ? "▤" : "♧"}</span><span className="quick-action-text"><strong>{title}</strong><small>{desc}</small></span><span className="quick-arrow">→</span></button>)}</div></div><div className="panel profile-mini"><div className="panel-heading"><div><h3>Account overview</h3><p>Your signed-in profile.</p></div><span className="panel-heading-icon">◉</span></div><div className="profile-mini-user"><div className="avatar avatar-large">{initials(profile?.name)}</div><div><strong>{profileLoading ? "Loading profile…" : profile?.name || ROLE_META[role].label}</strong><small>{profile?.email || "Signed in"}</small></div></div><div className="profile-line"><span>Account type</span><strong>{ROLE_META[role].label}</strong></div>{role === "DOCTOR" && <><div className="profile-line"><span>Specialization</span><strong>{profile?.specialization || "—"}</strong></div></>}<button className="text-button" onClick={() => onNavigate(role === "ADMIN" ? "create-doctor" : "profile")}>{role === "ADMIN" ? "Manage doctors" : "Manage profile"} <span>→</span></button></div></div>
  </div>;
}
function timeGreeting() { const h = new Date().getHours(); return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"; }


function Doctors({ token, onAction }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);
  const [booking, setBooking] = useState({
    appointmentTime: "",
    symptoms: ""
  });
  const [saving, setSaving] = useState(false);
  const [bookingError, setBookingError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setDoctors(await api("/doctors", { token }) || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const book = async e => {
    e.preventDefault();

    setSaving(true);
    setBookingError("");

    try {
      await api("/appointments", {
        token,
        method: "POST",
        body: {
          doctorId: selected.id,
          appointmentTime:
            booking.appointmentTime +
            (booking.appointmentTime.length === 16 ? ":00" : ""),
          symptoms: booking.symptoms.trim() || null
        }
      });

      setSelected(null);
      setBooking({
        appointmentTime: "",
        symptoms: ""
      });

      await onAction(
        async () => {},
        "Appointment booked successfully."
      );

      load();

    } catch (error) {
      setBookingError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content-stack">
      <PageTitle
        eyebrow="CARE DIRECTORY"
        title="Find your doctor"
        description="Explore your care team and book an appointment that works for you."
      />

      <div className="toolbar">
        <div className="toolbar-copy">
          <strong>
            {doctors.length} listed {doctors.length === 1 ? "doctor" : "doctors"}
          </strong>
          <span>Choose a specialist to get started.</span>
        </div>
        <button className="secondary-button" onClick={load}>
          ↻ Refresh
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <LoadingState label="Loading doctors…" />
      ) : doctors.length === 0 && !error ? (
        <EmptyState
          icon="✚"
          title="No doctors listed yet"
          text="There are no doctors available in the directory right now."
        />
      ) : (
        <div className="doctor-grid">
          {doctors.map((doctor, index) => (
            <article className="doctor-card" key={doctor.id}>
              <div className={`doctor-avatar avatar-tone-${index % 4}`}>
                {initials(doctor.name)}
              </div>

              <div className="doctor-card-body">
                <span className="doctor-available">
                  <i /> Listed in directory
                </span>

                <h3>Dr. {doctor.name}</h3>
                <p>{doctor.specialization || "General practice"}</p>

                <div className="doctor-card-id">
                  Doctor ID <code>{shortId(doctor.id)}</code>
                </div>

                <button
                  className="primary-button full-button"
                  onClick={() => {
                    setSelected(doctor);
                    setBookingError("");
                  }}
                >
                  Book appointment <span>→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <Modal
          title="Book an appointment"
          subtitle={`Request a visit with Dr. ${selected.name}.`}
          onClose={() => {
            setSelected(null);
            setBookingError("");
          }}
        >
          <form className="stack-form" onSubmit={book}>
            <div className="selected-doctor">
              <div className="doctor-avatar">
                {initials(selected.name)}
              </div>
              <div>
                <strong>Dr. {selected.name}</strong>
                <small>{selected.specialization}</small>
              </div>
            </div>

            {bookingError && (
              <div className="notice notice-error" role="alert">
                <span>!</span>
                <div>{bookingError}</div>
                <button
                  type="button"
                  onClick={() => setBookingError("")}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

            <label>
              Date and time
              <input
                type="datetime-local"
                min={new Date().toISOString().slice(0, 16)}
                value={booking.appointmentTime}
                onChange={e => {
                  setBooking({
                    ...booking,
                    appointmentTime: e.target.value
                  });
                  setBookingError("");
                }}
                required
              />
            </label>

            <label>
              Symptoms or reason for visit{" "}
              <span className="optional">(optional)</span>
              <textarea
                rows="3"
                maxLength={250}
                placeholder="Briefly describe what you'd like help with…"
                value={booking.symptoms}
                onChange={e =>
                  setBooking({
                    ...booking,
                    symptoms: e.target.value
                  })
                }
              />
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelected(null);
                  setBookingError("");
                }}
              >
                Cancel
              </button>

              <button className="primary-button" disabled={saving}>
                {saving ? "Booking…" : "Confirm booking"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}


function PatientAppointments({ token, onAction, onNavigate }) {
  const [appointments, setAppointments] = useState([]); const [doctors, setDoctors] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [filter, setFilter] = useState("ALL");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const [a,d] = await Promise.all([api("/appointments/my?page=0&size=100", { token }), api("/doctors", { token })]); setAppointments(pageContent(a)); setDoctors(Array.isArray(d) ? d : []); } catch (e) { setError(e.message); } finally { setLoading(false); } }, [token]);
  useEffect(() => { load(); }, [load]);
  const doctorName = id => doctors.find(d => d.id === id)?.name ? `Dr. ${doctors.find(d => d.id === id).name}` : shortId(id);
  const shown = appointments.filter(a => filter === "ALL" || a.status === filter);
  const cancel = async appointment => { if (!window.confirm("Cancel this appointment?")) return; const ok = await onAction(() => api(`/appointments/${appointment.id}/cancel`, { token, method: "PUT" }), "Appointment cancelled."); if (ok) load(); };
  return <div className="content-stack"><PageTitle eyebrow="YOUR CARE" title="Appointments" description="Keep track of upcoming visits and previous appointments." actions={<button className="primary-button" onClick={() => onNavigate("doctors")}>+ Book appointment</button>} /><div className="filter-row"><div className="segmented">{["ALL","SCHEDULED","COMPLETED","CANCELLED"].map(s => <button key={s} className={filter === s ? "selected" : ""} onClick={() => setFilter(s)}>{s === "ALL" ? "All" : titleCase(s)}</button>)}</div><button className="secondary-button" onClick={load}>↻ Refresh</button></div>
    {error && <ErrorState message={error} onRetry={load} />}{loading ? <LoadingState label="Loading appointments…" /> : shown.length === 0 ? <EmptyState icon="▦" title="No appointments here" text={filter === "ALL" ? "Book an appointment with a doctor to see it here." : `There are no ${filter.toLowerCase()} appointments.`} action={<button className="primary-button" onClick={() => onNavigate("doctors")}>Find a doctor</button>} /> : <div className="table-panel"><div className="table-scroll"><table><thead><tr><th>Doctor</th><th>Date & time</th><th>Reason / symptoms</th><th>Status</th><th>Action</th></tr></thead><tbody>{shown.map(a => <tr key={a.id}><td><div className="table-primary">{doctorName(a.doctorId)}</div><div className="table-secondary">ID {shortId(a.id)}</div></td><td>{formatDate(a.appointmentTime)}</td><td className="symptom-cell">{a.symptoms || "—"}</td><td><StatusBadge status={a.status} /></td><td>{a.status === "SCHEDULED" ? <button className="small-danger-button" onClick={() => cancel(a)}>Cancel</button> : <span className="muted-dash">—</span>}</td></tr>)}</tbody></table></div></div>}
  </div>;
}

function DoctorAppointments({ token, onAction }) {
  const [appointments, setAppointments] = useState([]); const [patients, setPatients] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [filter, setFilter] = useState("ALL");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const [a,p] = await Promise.all([api("/doctor/appointments?page=0&size=100", { token }), api("/doctor/patients", { token })]); setAppointments(pageContent(a)); setPatients(Array.isArray(p) ? p : []); } catch(e) { setError(e.message); } finally { setLoading(false); } }, [token]);
  useEffect(() => { load(); }, [load]);
  const patientName = id => patients.find(p => p.id === id)?.name || shortId(id);
  const updateStatus = async (appointment, status) => { const ok = await onAction(() => api(`/doctor/appointment/${appointment.id}/status`, { token, method: "PUT", body: { status } }), `Appointment marked ${status.toLowerCase()}.`); if (ok) load(); };
  const shown = appointments.filter(a => filter === "ALL" || a.status === filter);
  return <div className="content-stack"><PageTitle eyebrow="CLINICAL WORKSPACE" title="Appointments" description="Review your schedule and update appointment status." actions={<button className="secondary-button" onClick={load}>↻ Refresh</button>} /><div className="filter-row"><div className="segmented">{["ALL","SCHEDULED","COMPLETED","CANCELLED"].map(s => <button key={s} className={filter === s ? "selected" : ""} onClick={() => setFilter(s)}>{s === "ALL" ? "All" : titleCase(s)}</button>)}</div><span className="muted-count">{shown.length} appointments</span></div>
    {error && <ErrorState message={error} onRetry={load} />}{loading ? <LoadingState label="Loading appointments…" /> : shown.length === 0 ? <EmptyState icon="▦" title="No appointments to show" text="Appointments assigned to your account will appear here." /> : <div className="table-panel"><div className="table-scroll"><table><thead><tr><th>Patient</th><th>Date & time</th><th>Symptoms</th><th>Status</th><th>Update status</th></tr></thead><tbody>{shown.map(a => <tr key={a.id}><td><div className="table-primary">{patientName(a.patientId)}</div><div className="table-secondary">ID {shortId(a.patientId)}</div></td><td>{formatDate(a.appointmentTime)}</td><td className="symptom-cell">{a.symptoms || "—"}</td><td><StatusBadge status={a.status} /></td><td>{a.status === "SCHEDULED" ? <div className="inline-actions"><button className="small-success-button" onClick={() => updateStatus(a,"COMPLETED")}>Complete</button><button className="small-danger-button" onClick={() => updateStatus(a,"CANCELLED")}>Cancel</button></div> : <span className="muted-dash">Final</span>}</td></tr>)}</tbody></table></div></div>}
  </div>;
}

function DoctorPatients({ token, onAction, onNavigate }) {
  const [patients, setPatients] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setPatients(await api("/doctor/patients", { token }) || []); } catch(e) { setError(e.message); } finally { setLoading(false); } }, [token]);
  useEffect(() => { load(); }, [load]);
  return <div className="content-stack"><PageTitle eyebrow="PATIENT DIRECTORY" title="My patients" description="Patients who have appointments with your doctor account." actions={<button className="secondary-button" onClick={load}>↻ Refresh</button>} />
    {error && <ErrorState message={error} onRetry={load} />}{loading ? <LoadingState label="Loading patients…" /> : patients.length === 0 ? <EmptyState icon="♧" title="No patients yet" text="Patients with appointments assigned to you will appear here." /> : <div className="patient-grid">{patients.map(p => <article className="patient-card" key={p.id}><div className="avatar avatar-large">{initials(p.name)}</div><div className="patient-card-main"><strong>{p.name}</strong><span>Patient ID · {shortId(p.id)}</span></div><button className="secondary-button" onClick={() => { onNavigate("create-record"); }}>New record <span>→</span></button></article>)}</div>}
  </div>;
}

function Records({ token, endpoint, role }) {
  const [records, setRecords] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [page, setPage] = useState(0); const [totalPages, setTotalPages] = useState(1);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const data = await api(`${endpoint}?page=${page}&size=10&sort=createdAt,desc`, { token }); setRecords(pageContent(data)); setTotalPages(data?.totalPages || 1); } catch(e) { setError(e.message); } finally { setLoading(false); } }, [endpoint, page, token]);
  useEffect(() => { load(); }, [load]);
  return <div className="content-stack"><PageTitle eyebrow="HEALTH HISTORY" title="Medical records" description={role === "PATIENT" ? "Your diagnoses, treatments, and care notes." : "Clinical records you've created for your patients."} actions={<button className="secondary-button" onClick={load}>↻ Refresh</button>} />
    {error && <ErrorState message={error} onRetry={load} />}{loading ? <LoadingState label="Loading medical records…" /> : records.length === 0 ? <EmptyState icon="▤" title="No medical records yet" text={role === "PATIENT" ? "Records shared with your patient account will appear here." : "Records you create for your patients will appear here."} /> : <div className="record-grid">{records.map(record => <article className="record-card" key={record.id}><div className="record-card-top"><span className="record-icon">▤</span><span className="record-date">{formatDate(record.createdAt)}</span></div><h3>{record.diagnosis}</h3><div className="record-section"><span>TREATMENT</span><p>{record.treatment}</p></div>{record.notes && <div className="record-section"><span>NOTES</span><p>{record.notes}</p></div>}<div className="record-footer"><span>{role === "PATIENT" ? "Doctor" : "Patient"} ID</span><code>{shortId(role === "PATIENT" ? record.doctorId : record.patientId)}</code></div></article>)}</div>}
    {!loading && totalPages > 1 && <div className="pagination"><button className="secondary-button" disabled={page === 0} onClick={() => setPage(p => p-1)}>← Previous</button><span>Page {page+1} of {totalPages}</span><button className="secondary-button" disabled={page+1 >= totalPages} onClick={() => setPage(p => p+1)}>Next →</button></div>}
  </div>;
}

function CreateRecord({ token, onAction }) {
  const [patients, setPatients] = useState([]); const [loading, setLoading] = useState(true); const [patientId, setPatientId] = useState(""); const [diagnosis, setDiagnosis] = useState(""); const [treatment, setTreatment] = useState(""); const [notes, setNotes] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const data = await api("/doctor/patients", { token }); setPatients(Array.isArray(data) ? data : []); if (!patientId && data?.length) setPatientId(data[0].id); } catch(e) { setError(e.message); } finally { setLoading(false); } }, [token]);
  useEffect(() => { load(); }, [load]);
  const submit = async e => { e.preventDefault(); setSaving(true); const ok = await onAction(() => api("/medical-records", { token, method: "POST", body: { patientId, diagnosis: diagnosis.trim(), treatment: treatment.trim(), notes: notes.trim() || null } }), "Medical record created successfully."); setSaving(false); if (ok) { setDiagnosis(""); setTreatment(""); setNotes(""); } };
  return <div className="content-stack"><PageTitle eyebrow="CLINICAL DOCUMENTATION" title="Create medical record" description="Document a diagnosis and treatment for a patient with an appointment." />
    {error && <ErrorState message={error} onRetry={load} />}{!loading && patients.length === 0 && !error ? <EmptyState icon="♧" title="No eligible patients" text="Your patients with appointments will appear here. A medical record can only be created for a patient connected to your doctor account." /> : <div className="form-layout"><form className="panel form-panel" onSubmit={submit}><div className="form-section-title"><span className="form-step">01</span><div><h3>Patient details</h3><p>Choose the patient this record belongs to.</p></div></div><label>Patient<select value={patientId} onChange={e => setPatientId(e.target.value)} required disabled={loading || !patients.length}><option value="" disabled>{loading ? "Loading patients…" : "Select a patient"}</option>{patients.map(p => <option value={p.id} key={p.id}>{p.name} · {shortId(p.id)}</option>)}</select></label><div className="form-section-title section-gap"><span className="form-step">02</span><div><h3>Clinical information</h3><p>Enter the record details carefully.</p></div></div><label>Diagnosis<input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} required maxLength={255} placeholder="e.g. Seasonal allergy" /></label><label>Treatment<input value={treatment} onChange={e => setTreatment(e.target.value)} required maxLength={255} placeholder="e.g. Medication and rest" /></label><label>Notes <span className="optional">(optional)</span><textarea rows="4" value={notes} onChange={e => setNotes(e.target.value)} maxLength={255} placeholder="Additional observations or follow-up instructions…" /></label><div className="form-actions"><span className="field-hint">The record is saved to the selected patient's history.</span><button className="primary-button" disabled={saving || loading || !patients.length}>{saving ? "Saving…" : "Save medical record"} <span>→</span></button></div></form><aside className="side-note"><span className="side-note-icon">⌑</span><h3>Clinical note</h3><p>Records are associated with your doctor account and the selected patient. The backend verifies that an appointment exists before allowing creation.</p><div className="side-note-line" /><small>Keep notes concise and relevant to the patient's care.</small></aside></div>}
  </div>;
}

function Profile({ role, token, profile, reload, onAction }) {
  const [name, setName] = useState(profile?.name || "");
  const [age, setAge] = useState(profile?.age ?? "");
  const [blood, setBlood] = useState(profile?.blood || "");
  const [specialization, setSpecialization] = useState(profile?.specialization || "");
  const [licenseNumber, setLicenseNumber] = useState(profile?.licenseNumber || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile?.name || "");
    setAge(profile?.age ?? "");
    setBlood(profile?.blood || "");
    setSpecialization(profile?.specialization || "");
    setLicenseNumber(profile?.licenseNumber || "");
  }, [profile]);

  const submit = async e => {
    e.preventDefault();
    setSaving(true);

    const body = role === "PATIENT"
      ? {
          name: name.trim(),
          age: Number(age),
          blood: blood.trim()
        }
      : {
          name: name.trim(),
          specialization: specialization.trim(),
          licenseNumber: licenseNumber.trim()
        };

    const ok = await onAction(
      () => api(
        role === "PATIENT" ? "/patient/profile" : "/doctor/profile",
        { token, method: "PUT", body }
      ),
      "Profile updated successfully."
    );

    setSaving(false);

    if (ok) reload();
  };

  return (
    <div className="content-stack">
      <PageTitle
        eyebrow="ACCOUNT SETTINGS"
        title="My profile"
        description="Keep your account details up to date."
      />

      <div className="profile-layout">
        <div className="profile-hero">
          <div className="avatar avatar-profile">
            {initials(profile?.name)}
          </div>

          <span className="role-chip">{ROLE_META[role].label}</span>

          <h2>{profile?.name || "Your profile"}</h2>
          <p>{profile?.email}</p>

          <div className="profile-hero-rule" />

          <div className="profile-hero-detail">
            <span>Account email</span>
            <strong>{profile?.email || "—"}</strong>
          </div>

          <div className="profile-hero-detail">
            <span>Role</span>
            <strong>{ROLE_META[role].label}</strong>
          </div>

          {role === "PATIENT" && (
            <>
              <div className="profile-hero-detail">
                <span>Age</span>
                <strong>{profile?.age ?? "—"}</strong>
              </div>

              <div className="profile-hero-detail">
                <span>Blood group</span>
                <strong>{profile?.blood || "—"}</strong>
              </div>
            </>
          )}
        </div>

        <form className="panel profile-edit" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <h3>Personal information</h3>
              <p>Update the information associated with your account.</p>
            </div>
          </div>

          <label>
            Full name
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              maxLength={100}
            />
          </label>

          <label>
            Email address
            <input value={profile?.email || ""} disabled />
            <span className="field-hint">
              Email changes aren't supported by the current backend API.
            </span>
          </label>

          {role === "PATIENT" && (
            <>
              <label>
                Age
                <input
                  type="number"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  required
                  min="1"
                  max="150"
                />
              </label>

              <label>
                Blood group
                <select
                  value={blood}
                  onChange={e => setBlood(e.target.value)}
                >
                  <option value="">Select blood group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </label>
            </>
          )}

          {role === "DOCTOR" && (
            <>
              <label>
                Specialization
                <input
                  value={specialization}
                  onChange={e => setSpecialization(e.target.value)}
                  required
                  maxLength={255}
                />
              </label>

              <label>
                License number
                <input
                  value={licenseNumber}
                  onChange={e => setLicenseNumber(e.target.value)}
                  required
                  maxLength={255}
                />
              </label>
            </>
          )}

          <div className="form-actions">
            <span className="field-hint">
              Changes are saved to your account.
            </span>

            <button className="primary-button" disabled={saving}>
              {saving ? "Saving…" : "Save changes"} <span>→</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateDoctor({ token, onAction }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", specialization: "", licenseNumber: "" }); const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm(old => ({ ...old, [key]: value }));
  const submit = async e => { e.preventDefault(); setSaving(true); const ok = await onAction(() => api("/admin/doctor", { token, method: "POST", body: { ...form, name: form.name.trim(), email: form.email.trim(), specialization: form.specialization.trim(), licenseNumber: form.licenseNumber.trim() } }), "Doctor account created successfully."); setSaving(false); if (ok) setForm({ name: "", email: "", password: "", specialization: "", licenseNumber: "" }); };
  return <div className="content-stack"><PageTitle eyebrow="TEAM ADMINISTRATION" title="Add a doctor" description="Create a doctor account and clinical profile. Only administrators can use this action." /><div className="form-layout"><form className="panel form-panel" onSubmit={submit}><div className="form-section-title"><span className="form-step">01</span><div><h3>Account details</h3><p>These details are used to sign in.</p></div></div><label>Doctor's full name<input value={form.name} onChange={e => update("name",e.target.value)} required maxLength={100} placeholder="e.g. Dr. Aditi Sharma" /></label><label>Email address<input type="email" value={form.email} onChange={e => update("email",e.target.value)} required placeholder="doctor@hospital.com" /></label><label>Temporary password<input type="password" minLength={6} value={form.password} onChange={e => update("password",e.target.value)} required placeholder="At least 6 characters" /><span className="field-hint">Share credentials securely with the doctor.</span></label><div className="form-section-title section-gap"><span className="form-step">02</span><div><h3>Clinical profile</h3><p>Enter the doctor's professional details.</p></div></div><label>Specialization<input value={form.specialization} onChange={e => update("specialization",e.target.value)} required placeholder="e.g. Cardiology" /></label><label>License number<input value={form.licenseNumber} onChange={e => update("licenseNumber",e.target.value)} required placeholder="Professional license number" /></label><div className="form-actions"><span className="field-hint">The new account receives the DOCTOR role.</span><button className="primary-button" disabled={saving}>{saving ? "Creating…" : "Create doctor account"} <span>→</span></button></div></form><aside className="side-note"><span className="side-note-icon">✚</span><h3>Doctor access</h3><p>New doctor accounts can sign in, manage their profile, review appointments, view connected patients, and create medical records.</p><div className="side-note-line" /><small>Only an authenticated administrator can create doctor accounts.</small></aside></div></div>;
}

function PageTitle({ eyebrow, title, description, actions }) { return <div className="page-title-row"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-title-actions">{actions}</div>}</div>; }
function StatusBadge({ status }) { const tone = status === "COMPLETED" ? "status-completed" : status === "CANCELLED" ? "status-cancelled" : "status-scheduled"; return <span className={`status-badge ${tone}`}><i />{titleCase(status || "Unknown")}</span>; }
function titleCase(text = "") { return text.toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase()); }
function LoadingState({ label }) { return <div className="loading-state"><span className="spinner spinner-dark" />{label}</div>; }
function ErrorState({ message, onRetry }) { return <div className="error-state"><span className="error-symbol">!</span><div><strong>We couldn't load this information</strong><p>{message}</p></div><button className="secondary-button" onClick={onRetry}>Try again</button></div>; }
function EmptyState({ icon, title, text, action }) { return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{action && <div className="empty-action">{action}</div>}</div>; }
function Modal({ title, subtitle, onClose, children }) { useEffect(() => { const handler = e => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [onClose]); return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Close dialog">×</button></div>{children}</div></div>; }

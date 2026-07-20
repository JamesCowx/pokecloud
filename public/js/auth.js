// ============================================
// PokeCloud Auth - JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  checkAuth();

  // Setup form handlers
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
});

// Check if user is already authenticated
async function checkAuth() {
  try {
    const res = await fetch('/api/user');
    if (res.ok) {
      window.location.href = '/dashboard';
    }
  } catch (err) {
    // Not logged in, stay on page
  }
}

// Handle Login
async function handleLogin(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = document.getElementById('submitBtn');
  const messageEl = document.getElementById('formMessage');

  const username = form.username.value.trim();
  const password = form.password.value;

  if (!username || !password) {
    showMessage(messageEl, 'Please fill in all fields', 'error');
    return;
  }

  // Show loading state
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;
  clearMessage(messageEl);

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok) {
      showMessage(messageEl, 'Login successful! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 800);
    } else {
      showMessage(messageEl, data.error || 'Login failed', 'error');
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  } catch (err) {
    showMessage(messageEl, 'Network error. Please try again.', 'error');
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
}

// Handle Register
async function handleRegister(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = document.getElementById('submitBtn');
  const messageEl = document.getElementById('formMessage');

  const username = form.username.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;

  if (!username || !email || !password || !confirmPassword) {
    showMessage(messageEl, 'Please fill in all fields', 'error');
    return;
  }

  if (username.length < 3) {
    showMessage(messageEl, 'Username must be at least 3 characters', 'error');
    return;
  }

  if (password.length < 6) {
    showMessage(messageEl, 'Password must be at least 6 characters', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showMessage(messageEl, 'Passwords do not match', 'error');
    return;
  }

  // Show loading state
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;
  clearMessage(messageEl);

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json();

    if (res.ok) {
      showMessage(messageEl, 'Account created! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 800);
    } else {
      showMessage(messageEl, data.error || 'Registration failed', 'error');
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  } catch (err) {
    showMessage(messageEl, 'Network error. Please try again.', 'error');
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
}

// Show message
function showMessage(el, text, type) {
  el.textContent = text;
  el.className = `form-message ${type}`;
}

// Clear message
function clearMessage(el) {
  el.textContent = '';
  el.className = 'form-message';
}

// Toggle password visibility
function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  const icon = field.parentElement.querySelector('.eye-icon');

  if (field.type === 'password') {
    field.type = 'text';
    icon.innerHTML = `
      <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
    `;
  } else {
    field.type = 'password';
    icon.innerHTML = `
      <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    `;
  }
}

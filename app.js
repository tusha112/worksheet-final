// ============================================================
// MATHSHEET PRO — app.js
// Shared utilities: nav, search, animations
// ============================================================

/* ---- Mobile Menu Toggle ---- */
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('open');
}

/* ---- Navbar scroll effect ---- */
(function() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
})();

/* ---- Hero search bar (homepage) ---- */
function heroSearch(e) {
  e.preventDefault();
  const q = document.getElementById('heroSearchInput')?.value?.trim();
  if (!q) return;

  // Map common keywords to operations
  const query = q.toLowerCase();
  let op = 'multiplication';
  if (query.includes('add')) op = 'addition';
  else if (query.includes('sub') || query.includes('minus')) op = 'subtraction';
  else if (query.includes('div')) op = 'division';
  else if (query.includes('frac')) op = 'mixed';
  else if (query.includes('mix')) op = 'mixed';

  window.location.href = `worksheet.html?op=${op}&q=${encodeURIComponent(q)}`;
}

/* ---- Nav search (desktop search bar) ---- */
(function() {
  const navSearch = document.getElementById('navSearch');
  if (!navSearch) return;
  navSearch.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = navSearch.value.trim();
      if (!q) return;
      const query = q.toLowerCase();
      let op = 'multiplication';
      if (query.includes('add')) op = 'addition';
      else if (query.includes('sub')) op = 'subtraction';
      else if (query.includes('div')) op = 'division';
      else if (query.includes('frac')) op = 'mixed';
      window.location.href = `worksheet.html?op=${op}&q=${encodeURIComponent(q)}`;
    }
  });
})();

/* ---- Intersection Observer for scroll animation ---- */
(function() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });

  /* ---- Add fade-up to cards and observe immediately ---- */
  document.addEventListener('DOMContentLoaded', () => {
    const animTargets = document.querySelectorAll(
      '.category-card, .step-card, .fs-card, .topic-card, .grade-pill, .seasonal-card, .topic-card-item'
    );
    animTargets.forEach((el, i) => {
      el.classList.add('fade-up');
      el.style.transitionDelay = `${Math.min(i * 0.04, 0.5)}s`;
      observer.observe(el); // observe right away, not in a separate loop
    });

    // Immediately make visible anything already in viewport
    requestAnimationFrame(() => {
      document.querySelectorAll('.fade-up').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          el.classList.add('visible');
        }
      });
    });
  });
})();


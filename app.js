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

/* ============================================================
   DONATION SECTION LOGIC
   ============================================================ */
window.currentDonateAmount = 50; // Default amount matching the checked radio

window.updateDonateButton = function(amount) {
  window.currentDonateAmount = amount;
  const btn = document.getElementById('donateMainBtn');
  if (btn) btn.innerText = `Donate ₹${amount}`;
  
  // Clear the custom input field when a predefined tier is clicked
  const customInput = document.querySelector('.currency-input input');
  if (customInput && customInput.value !== amount.toString()) {
    customInput.value = '';
  }
};

window.updateCustomAmount = function(amount) {
  if (!amount || isNaN(amount)) return;
  
  // Uncheck all predefined tier radio buttons when typing a custom amount
  document.querySelectorAll('input[name="donateAmount"]').forEach(radio => radio.checked = false);
  
  const val = parseInt(amount, 10);
  if (val > 0) {
    window.currentDonateAmount = val;
    const btn = document.getElementById('donateMainBtn');
    if (btn) {
      // If below 20, we can still show the amount but maybe the processor will enforce min 20
      btn.innerText = `Donate ₹${val}`;
    }
  }
};

// Form submission for donation (Razorpay)
async function handleDonate(event) {
  if (event) event.preventDefault();

  const amountInput = document.getElementById('amount');
  const nameInput = document.getElementById('name');
  const button = document.getElementById('donateMainBtn');

  let amountStr = amountInput ? amountInput.value.trim() : '';
  const name = nameInput ? nameInput.value.trim() : 'Anonymous';

  let amount = window.currentDonateAmount || 50;
  if (amountStr !== "") {
    amount = Number(amountStr);
  }

  if (isNaN(amount) || amount < 20) {
    alert("Minimum donation amount is ₹20.");
    return;
  }

  let originalButtonText = "Donate";
  if (button) {
    originalButtonText = button.innerText;
    button.disabled = true;
    button.innerText = "Connecting...";
  }

  try {
    // 1. Create order on backend (switching to port 3001 to avoid conflicts)
    const response = await fetch("https://worksheet-final.onrender.com/create-order", {",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, name })
    });

    if (!response.ok) throw new Error("Failed to create order on server");
    const orderData = await response.json();

    // 2. Open Razorpay Checkout
    const options = {
      "key": "rzp_live_SdIK88FPGdw6aN", 
      "amount": orderData.amount,
      "currency": orderData.currency,
      "name": "MathSheet Pro",
      "description": "Donation to support free education",
      "image": "https://mathsheetpro.com/logo.png", // Replace with actual logo
      "order_id": orderData.id,
      "handler": function (response) {
        alert("Thank you! Payment Successful. ID: " + response.razorpay_payment_id);
        // Optionally redirect to success page
        window.location.href = "index.html?payment=success";
      },
      "prefill": {
        "name": name,
        "email": "guest@example.com",
        "contact": "9999999999"
      },
      "theme": {
        "color": "#6c63ff"
      },
      "modal": {
        "ondismiss": function() {
          if (button) {
            button.disabled = false;
            button.innerText = originalButtonText;
          }
        }
      }
    };

    const rzp1 = new Razorpay(options);
    rzp1.open();

  } catch (error) {
    console.error("Razorpay error:", error);
    alert("There was an error connecting to Razorpay. Please make sure the backend server is running and your keys are correct.");
    if (button) {
      button.disabled = false;
      button.innerText = originalButtonText;
    }
  }
}

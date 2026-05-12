/* ─────────────────────────────────────────────────────────────────── */
/* main.js — الكود الرئيسي للمتجر (SaaS - Mobile First Design)         */
/* ─────────────────────────────────────────────────────────────────── */

// ─── Lazy Load Images ────────────────────────────────────────────────
document.querySelectorAll('img[loading="lazy"]').forEach(img => {
  if (img.complete) {
    img.classList.add('loaded');
  } else {
    img.addEventListener('load', () => img.classList.add('loaded'));
  }
});

// ─── Mobile Menu ─────────────────────────────────────────────────────
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu    = document.getElementById('mobileMenu');
const menuOverlay   = document.getElementById('menuOverlay');
const closeMenu     = document.getElementById('closeMenu');

function openMenu()  { if (mobileMenu) { mobileMenu.classList.remove('hidden'); document.body.style.overflow = 'hidden'; } }
function closeMenuFn() { if (mobileMenu) { mobileMenu.classList.add('hidden'); document.body.style.overflow = ''; } }

if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openMenu);
if (closeMenu)     closeMenu.addEventListener('click', closeMenuFn);
if (menuOverlay)   menuOverlay.addEventListener('click', closeMenuFn);

// ─── Load Categories (Header row + Sidebar) ──────────────────────────
async function loadCategories() {
  try {
    const res  = await fetch('/api/categories');
    const cats = await res.json();
    const params    = new URLSearchParams(window.location.search);
    const currentCat = params.get('cat') || '';

    // Top bar row
    const catRow = document.getElementById('catRow');
    if (catRow && cats.length > 0) {
      catRow.innerHTML = '';
      // "الكل"
      const allEl = document.createElement('a');
      allEl.href = '/products';
      allEl.className = `flex-none flex flex-col items-center gap-1 min-w-[52px] ${!currentCat ? 'active' : ''}`;
      allEl.innerHTML = `
        <div class="cat-circle flex items-center justify-center bg-pink-50">
          <i class="fas fa-th-large text-pink-400 text-xs"></i>
        </div>
        <span class="cat-label">الكل</span>`;
      catRow.appendChild(allEl);

      cats.forEach(cat => {
        const a = document.createElement('a');
        a.href = `/products?cat=${cat._id}`;
        a.className = `flex-none flex flex-col items-center gap-1 min-w-[52px] ${currentCat === cat._id ? 'active' : ''}`;
        const imgHTML = cat.image
          ? `<img src="${cat.image}" alt="${cat.name}" class="w-full h-full object-cover" loading="lazy" />`
          : `<i class="fas fa-tag text-pink-300 text-xs"></i>`;
        a.innerHTML = `
          <div class="cat-circle flex items-center justify-center">${imgHTML}</div>
          <span class="cat-label">${cat.name}</span>`;
        catRow.appendChild(a);
      });
    }

    // Sidebar cats
    const sidebarCats = document.getElementById('sidebarCats');
    if (sidebarCats && cats.length > 0) {
      sidebarCats.innerHTML = '';
      cats.forEach(cat => {
        const a = document.createElement('a');
        a.href = `/products?cat=${cat._id}`;
        a.className = 'flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 text-sm font-medium';
        if (cat.image) {
          a.innerHTML = `<img src="${cat.image}" class="w-7 h-7 rounded-full object-cover flex-none" loading="lazy" /> ${cat.name}`;
        } else {
          a.innerHTML = `<i class="fas fa-tag text-pink-400 w-5 text-center"></i> ${cat.name}`;
        }
        sidebarCats.appendChild(a);
      });
    }
  } catch(e) { /* silent */ }
}
loadCategories();

// ─── Live Search ──────────────────────────────────────────────────────
const searchInput   = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
let searchTimer;

if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { searchResults.classList.add('hidden'); return; }

    searchTimer = setTimeout(async () => {
      try {
        const res      = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const products = await res.json();
        searchResults.innerHTML = '';

        if (products.length === 0) {
          searchResults.innerHTML = '<div class="p-4 text-sm text-gray-400 text-center">لا توجد نتائج</div>';
        } else {
          products.forEach(p => {
            const a = document.createElement('a');
            a.href  = `/products/${p.slug}`;
            a.innerHTML = `
              <img src="${p.images?.[0] || '/img/placeholder.png'}" alt="${p.name}"
                   loading="lazy" onerror="this.src='/img/placeholder.png'" />
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</div>
                <div style="font-size:12px;color:#EC4899;font-weight:700">${p.basePrice.toLocaleString('ar-IQ')} ${window._currency || 'د.ع'}</div>
              </div>`;
            searchResults.appendChild(a);
          });

          const all = document.createElement('a');
          all.href = `/products?q=${encodeURIComponent(q)}`;
          all.style.cssText = 'justify-content:center;color:#EC4899;font-weight:700;background:#fdf2f8;border-bottom:none;font-size:13px';
          all.textContent = `عرض كل النتائج لـ "${q}"`;
          searchResults.appendChild(all);
        }
        searchResults.classList.remove('hidden');
      } catch(e) { searchResults.classList.add('hidden'); }
    }, 300);
  });

  document.addEventListener('click', e => {
    if (searchInput && !searchInput.contains(e.target) && searchResults && !searchResults.contains(e.target)) {
      searchResults.classList.add('hidden');
    }
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      window.location.href = `/products?q=${encodeURIComponent(searchInput.value.trim())}`;
    }
  });
}

// ─── Add to Cart ──────────────────────────────────────────────────────
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.add-to-cart-btn');
  if (!btn) return;

  const productId = btn.dataset.id;
  if (!productId) return;

  btn.disabled = true;
  const icon = btn.querySelector('i');
  const originalIcon = icon ? icon.className : '';
  if (icon) { icon.className = 'fas fa-spinner fa-spin text-base'; }

  try {
    const res  = await fetch('/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, qty: 1 })
    });
    const data = await res.json();

    if (data.success) {
      updateCartBadge(data.cartCount);
      showToast('✓ تمت الإضافة للسلة');
      if (icon) { icon.className = 'fas fa-check text-base'; }
      setTimeout(() => {
        if (icon) icon.className = originalIcon;
        btn.disabled = false;
      }, 1000);
    } else {
      showToast(data.message || 'حدث خطأ', 3000);
      if (icon) icon.className = originalIcon;
      btn.disabled = false;
    }
  } catch(err) {
    showToast('حدث خطأ في الاتصال');
    if (icon) icon.className = originalIcon;
    btn.disabled = false;
  }
});

// ─── Cart Badge Update ────────────────────────────────────────────────
function updateCartBadge(count) {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  badge.textContent = count;
  if (count > 0) {
    badge.classList.remove('hidden');
    badge.classList.add('flex');
    badge.classList.add('cart-bounce');
    setTimeout(() => badge.classList.remove('cart-bounce'), 400);
  } else {
    badge.classList.remove('flex');
    badge.classList.add('hidden');
  }
}

// ─── Toast Helper ─────────────────────────────────────────────────────
function showToast(msg, duration = 2000) {
  let t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.classList.add('hidden'), 300);
  }, duration);
}

// ─── Banner Slider ────────────────────────────────────────────────────
(function initBannerSlider() {
  const slides = document.querySelectorAll('.banner-slide');
  const dots   = document.querySelectorAll('.banner-dot');
  if (slides.length <= 1) return;

  let current = 0;
  function goTo(idx) {
    slides[current].classList.remove('active');
    dots[current]?.classList.remove('active');
    current = (idx + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current]?.classList.add('active');
  }

  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

  // Auto-play every 4s
  let timer = setInterval(() => goTo(current + 1), 4000);

  const slider = document.getElementById('bannerSlider');
  if (slider) {
    slider.addEventListener('mouseenter', () => clearInterval(timer));
    slider.addEventListener('mouseleave', () => { timer = setInterval(() => goTo(current + 1), 4000); });
  }
})();

// ─── Confirm Delete ───────────────────────────────────────────────────
document.querySelectorAll('[data-confirm]').forEach(el => {
  el.addEventListener('click', e => {
    if (!confirm(el.dataset.confirm)) e.preventDefault();
  });
});


// ─── Mobile Menu ─────────────────────────────────────────────────────
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu    = document.getElementById('mobileMenu');
if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
  });
}

// ─── Load Nav Categories ─────────────────────────────────────────────
async function loadNavCategories() {
  const nav = document.getElementById('navCategories');
  if (!nav) return;
  try {
    const res  = await fetch('/api/categories');
    const cats = await res.json();
    const params = new URLSearchParams(window.location.search);
    const currentCat = params.get('cat') || '';
    cats.forEach(cat => {
      const a = document.createElement('a');
      a.href      = `/products?cat=${cat._id}`;
      a.className = `nav-cat-link px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap hover:bg-amber-50 hover:text-amber-700 transition-all ${currentCat === cat._id ? 'active' : ''}`;
      a.textContent = cat.name;
      nav.appendChild(a);
    });
  } catch (e) { /* silent */ }
}
loadNavCategories();

// ─── Live Search ─────────────────────────────────────────────────────
const searchInput   = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
let searchTimer;

if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { searchResults.classList.add('hidden'); return; }
    searchTimer = setTimeout(async () => {
      try {
        const res      = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const products = await res.json();
        searchResults.innerHTML = '';
        if (products.length === 0) {
          searchResults.innerHTML = '<div class="p-4 text-sm text-gray-400 text-center">لا توجد نتائج</div>';
        } else {
          products.forEach(p => {
            const a = document.createElement('a');
            a.href  = `/products/${p.slug}`;
            a.innerHTML = `
              <img src="${p.images[0] || '/img/placeholder.png'}" alt="${p.name}" onerror="this.src='/img/placeholder.png'" />
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
                <div style="color:#b45309;font-size:12px">${p.basePrice.toLocaleString('ar-IQ')} د.ع</div>
              </div>`;
            searchResults.appendChild(a);
          });
          // View all
          const all = document.createElement('a');
          all.href  = `/products?q=${encodeURIComponent(q)}`;
          all.style.cssText = 'justify-content:center;color:#b45309;font-weight:600;background:#fffbeb;';
          all.textContent   = `عرض كل النتائج لـ "${q}"`;
          searchResults.appendChild(all);
        }
        searchResults.classList.remove('hidden');
      } catch (e) {
        searchResults.classList.add('hidden');
      }
    }, 300);
  });

  // إخفاء النتائج عند النقر خارجها
  document.addEventListener('click', e => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.add('hidden');
    }
  });

  // البحث بزر Enter
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      window.location.href = `/products?q=${encodeURIComponent(searchInput.value.trim())}`;
    }
  });
}

// ─── Slider Scroll ────────────────────────────────────────────────────
function scrollSlider(id, dir) {
  const el = document.getElementById(id);
  if (el) el.scrollBy({ left: dir * 220, behavior: 'smooth' });
}

// ─── Cart Badge Update ────────────────────────────────────────────────
function updateCartBadge(count) {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  badge.textContent = count;
  if (count > 0) {
    badge.classList.remove('hidden');
    badge.classList.add('flex');
    badge.classList.add('cart-pop');
    setTimeout(() => badge.classList.remove('cart-pop'), 400);
  } else {
    badge.classList.add('hidden');
  }
}

// ─── Toast Helper ─────────────────────────────────────────────────────
function showToast(msg, duration = 2500) {
  let t = document.getElementById('global-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'global-toast';
    t.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-xl text-sm z-50 hidden';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), duration);
}

// ─── Confirm Delete Forms ─────────────────────────────────────────────
document.querySelectorAll('[data-confirm]').forEach(el => {
  el.addEventListener('click', e => {
    if (!confirm(el.dataset.confirm)) e.preventDefault();
  });
});

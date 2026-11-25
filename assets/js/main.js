const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const header = document.querySelector(".site-header");
const navIndicator = document.querySelector(".nav-indicator");
const navLinks = document.querySelectorAll(".site-nav a");
const headerCta = document.querySelector(".header-cta");
const privacyToast = document.querySelector(".privacy-toast");
const privacyButton = document.querySelector(".privacy-toast button");

navToggle?.addEventListener("click", () => {
  const isOpen = siteNav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

const moveNavIndicator = () => {};

const setActiveNav = (link) => {
  navLinks.forEach((navLink) => navLink.classList.toggle("is-active", navLink === link));
  moveNavIndicator(link);
};

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    siteNav.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
    setActiveNav(link);
  });

  link.addEventListener("mouseenter", () => moveNavIndicator(link));
});

siteNav?.addEventListener("mouseleave", () => {
  moveNavIndicator(document.querySelector(".site-nav a.is-active"));
});

window.addEventListener("load", () => {
  moveNavIndicator(document.querySelector(".site-nav a.is-active"));
});

window.addEventListener("resize", () => {
  moveNavIndicator(document.querySelector(".site-nav a.is-active"));
});

async function hydrateHeaderAccount() {
  if (!headerCta) return;
  try {
    const response = await fetch("/api/me?soft=1");
    if (!response.ok) {
      headerCta.classList.remove("is-authed");
      headerCta.href = headerCta.getAttribute("data-login-href") || "login";
      headerCta.removeAttribute("title");
      return;
    }
    const payload = await response.json();
    const user = payload.user;
    if (!user) {
      headerCta.classList.remove("is-authed");
      headerCta.href = headerCta.getAttribute("data-login-href") || "login";
      headerCta.removeAttribute("title");
      return;
    }
    headerCta.classList.add("is-authed");
    headerCta.href = "account";
    headerCta.textContent = "Mi cuenta";
    headerCta.title = `Sesion activa: ${user.username}`;
  } catch {}
}

hydrateHeaderAccount();

const navSections = [...navLinks]
  .filter((link) => link.getAttribute("href")?.startsWith("#"))
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

// Sección activa: la última cuyo borde superior ya pasó el 40 % de la pantalla (al fondo, la última).
// Se calcula en cada cuadro de scroll, así la isla la sigue al instante.
let navTicking = false;
const updateActiveSection = () => {
  navTicking = false;
  if (!navSections.length) return;
  const line = window.innerHeight * 0.4;
  let current = null;
  navSections.forEach((section) => { if (section.getBoundingClientRect().top <= line) current = section; });
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = navSections[navSections.length - 1];
  const nextLink = current
    ? document.querySelector(`.site-nav a[href="#${current.id}"], .site-nav a[href="/#${current.id}"]`)
    : null;
  const active = document.querySelector('.site-nav a.is-active');
  if (nextLink !== active) {
    if (nextLink) setActiveNav(nextLink);
    else navLinks.forEach((navLink) => navLink.classList.remove('is-active'));
  }
};
window.addEventListener('scroll', () => {
  if (navTicking) return;
  navTicking = true;
  requestAnimationFrame(updateActiveSection);
}, { passive: true });
updateActiveSection();

window.addEventListener("scroll", () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 24);
});

// Privacy toast with localStorage persistence
if (localStorage.getItem('ALLMIGHTY-privacy') === 'ok') {
  privacyToast?.classList.add('is-hidden');
}

privacyButton?.addEventListener("click", () => {
  privacyToast?.classList.add("is-hidden");
  localStorage.setItem('ALLMIGHTY-privacy', 'ok');
});

window.addEventListener('DOMContentLoaded', () => {
// === Contact Modal Logic ===
  const contactModal = document.getElementById('contactModal');
  const contactModalClose = document.getElementById('contactModalClose');
  const contactModalOverlay = document.getElementById('contactModalOverlay');
  const cartDrawer = document.querySelector('[data-cart-drawer]');
  const cartCount = document.querySelector('[data-cart-count]');
  const cartEmpty = document.querySelector('[data-cart-empty]');
  const cartContent = document.querySelector('[data-cart-content]');
  const cartTotal = document.querySelector('[data-cart-total]');
  const cartNote = document.querySelector('[data-cart-note]');
  const cartCheckout = document.querySelector('[data-cart-checkout]');
  const cartAccount = document.querySelector('[data-cart-account]');
  const cartAccountTitle = document.querySelector('[data-cart-account-title]');
  const cartAccountNote = document.querySelector('[data-cart-account-note]');
  const cartDiscord = document.querySelector('[data-cart-discord]');
  const cartLogout = document.querySelector('[data-cart-logout]');
  const cartServerPicker = document.querySelector('[data-cart-server-picker]');
  const cartServersNote = document.querySelector('[data-cart-servers-note]');
  const cartGuildHint = document.querySelector('[data-cart-guild-hint]');
  const cartGuildInput = document.getElementById('cart-guild');
  const cartNameInput = document.getElementById('cart-name');
  const cartEmailInput = document.getElementById('cart-email');
  const cartDiscordInput = document.getElementById('cart-discord');
  const allmightyPlans = {
    free: { label: 'Lifetime Free', price: 0 },
    monthly: { label: 'Mensual', price: 20 },
    quarterly: { label: 'Trimestral', price: 40 },
    annual: { label: 'Anual', price: 145 }
  };
  let allmightyCart = { hasItem: false, plan: 'monthly' };
  // Cómo se cobra: en línea con MercadoPago (en pesos) o por ticket. Lo dice /api/plans.
  let paymentsInfo = { online: false, currency: 'USD', usdRate: 1 };
  const chargeFor = (priceUsd) => {
    const price = Number(priceUsd) || 0;
    if (!paymentsInfo.online || paymentsInfo.currency === 'USD') return null;
    const raw = price * (Number(paymentsInfo.usdRate) || 0);
    const amount = paymentsInfo.currency === 'CLP' ? Math.round(raw) : Math.round(raw * 100) / 100;
    return `$${amount.toLocaleString('es-CL')} ${paymentsInfo.currency}`;
  };
  // Cupón de la bolsa: { code, label, prices: { planId: { before, price } } } (POST /api/coupons/check).
  let cartCoupon = null;
  let storeAccountUser = null;
  let storeServers = [];
  let storeSelectedServer = null;
  let storePickerOpen = true;

  try {
    allmightyCart = { ...allmightyCart, ...(JSON.parse(localStorage.getItem('ALLMIGHTY-allmighty-cart') || '{}')) };
  } catch {
    allmightyCart = { hasItem: false, plan: 'monthly' };
  }

  const saveCart = () => {
    localStorage.setItem('ALLMIGHTY-allmighty-cart', JSON.stringify(allmightyCart));
  };

  const renderStoreAccount = () => {
    const isLoggedIn = Boolean(storeAccountUser);
    const hasDiscord = Boolean(storeAccountUser?.discord?.id);
    cartAccount?.classList.toggle('is-ready', isLoggedIn);
    if (cartAccountTitle) {
      cartAccountTitle.textContent = isLoggedIn
        ? `Sesión activa: ${storeAccountUser.discord?.username || storeAccountUser.username}`
        : 'Inicia sesión';
    }
    if (cartAccountNote) {
      cartAccountNote.textContent = isLoggedIn
        ? (hasDiscord
            ? 'Compras, código y servidor quedarán asociados a tu cuenta de Discord.'
            : 'Inicia sesión con Discord para elegir tu servidor y continuar la compra.')
        : 'Entra con Discord para elegir tu servidor y asociarle la compra.';
    }
    if (cartDiscord) cartDiscord.hidden = isLoggedIn && hasDiscord;
    if (cartLogout) cartLogout.hidden = !isLoggedIn;
  };

  const fillReadonlyField = (input, value) => {
    if (!input) return;
    input.value = value || '';
    input.readOnly = Boolean(value);
  };

  const refreshCheckoutFields = () => {
    const discord = storeAccountUser?.discord || null;
    fillReadonlyField(cartNameInput, discord?.username || '');
    fillReadonlyField(cartDiscordInput, discord?.id || '');
    if (storeAccountUser?.email) {
      fillReadonlyField(cartEmailInput, storeAccountUser.email);
    } else if (cartEmailInput) {
      cartEmailInput.value = '';
      cartEmailInput.readOnly = false;
    }
  };

  const updateGuildHint = () => {
    if (!cartGuildHint) return;
    if (storeSelectedServer) {
      cartGuildHint.textContent = `Servidor seleccionado: ${storeSelectedServer.name}`;
      cartGuildHint.classList.remove('is-warning');
      cartGuildHint.classList.add('is-ok');
    } else {
      cartGuildHint.textContent = '';
      cartGuildHint.classList.remove('is-warning', 'is-ok');
    }
  };

  const selectStoreServer = (server) => {
    storeSelectedServer = server;
    if (cartGuildInput) cartGuildInput.value = server ? server.id : '';
    storePickerOpen = !server;
    updateGuildHint();
    renderStoreServerPicker();
    if (cartCoupon && typeof applyCoupon === 'function') applyCoupon(cartCoupon.code, { quiet: true });
  };

  // Miembros (si Discord los da) y tu rol en el servidor.
  const serverMeta = (server) => {
    const parts = [];
    if (server.memberCount) parts.push(`${Number(server.memberCount).toLocaleString('es-CL')} miembros`);
    parts.push(server.owner ? 'Dueño' : 'Administrador');
    return parts.join(' · ');
  };

  const renderStoreServerPicker = () => {
    if (!cartServerPicker) return;
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    if (!storeServers.length) {
      cartServerPicker.innerHTML = '<p class="cart-server-picker-note">No administras ningún servidor de Discord. Para comprar necesitas ser dueño del servidor o tener el permiso Administrar servidor. Si te lo dieron hace poco, cierra sesión y vuelve a entrar con Discord.</p>';
      return;
    }

    if (storeSelectedServer && !storePickerOpen) {
      const server = storeSelectedServer;
      const initials = String(server.name || '?').split(/[^A-Za-z0-9]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
      const icon = server.icon
        ? `<img src="${esc(server.icon)}" alt="" loading="lazy">`
        : `<span>${esc(initials)}</span>`;
      const meta = serverMeta(server);
      cartServerPicker.innerHTML = `
        <div class="cart-server-option is-selected" data-cart-server-id="${esc(server.id)}" data-cart-has-bot="1">
          <span class="cart-server-icon">${icon}</span>
          <span class="cart-server-meta"><strong>${esc(server.name)}</strong><small>${esc(meta)}</small></span>
          <span class="cart-server-chip is-live">Bot activo</span>
        </div>
        <button type="button" class="cart-server-change" data-cart-change-server>Cambiar servidor</button>`;
      cartServerPicker.querySelector("[data-cart-change-server]").addEventListener("click", () => {
        storePickerOpen = true;
        renderStoreServerPicker();
      });
      return;
    }

    const rows = storeServers.map((server) => {
      const initials = String(server.name || '?').split(/[^A-Za-z0-9]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
      const icon = server.icon
        ? `<img src="${esc(server.icon)}" alt="" loading="lazy">`
        : `<span>${esc(initials)}</span>`;
      const meta = serverMeta(server);
      if (server.hasBot) {
        return `
          <button type="button" class="cart-server-option" data-cart-server-id="${esc(server.id)}" data-cart-has-bot="1">
            <span class="cart-server-icon">${icon}</span>
            <span class="cart-server-meta"><strong>${esc(server.name)}</strong><small>${esc(meta)}</small></span>
            <span class="cart-server-chip is-live">Bot activo</span>
          </button>`;
      }
      return `
        <div class="cart-server-option is-missing" data-cart-server-id="${esc(server.id)}" data-cart-has-bot="0">
          <span class="cart-server-icon">${icon}</span>
          <span class="cart-server-meta"><strong>${esc(server.name)}</strong><small>${esc(meta)}</small></span>
          <a class="cart-server-invite" href="account?invite=${encodeURIComponent(server.id)}#servidores">Añadir el bot a tu servidor</a>
        </div>`;
    }).join('');

    cartServerPicker.innerHTML = `
      <div class="cart-server-picker-head">
        <span>Elige tu servidor</span>
        <button type="button" class="cart-server-refresh" data-cart-servers-refresh title="Refrescar lista de servidores" aria-label="Refrescar lista de servidores"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></button>
      </div>
      ${rows}`;

    cartServerPicker.querySelectorAll("[data-cart-has-bot='1']").forEach((button) => {
      button.addEventListener("click", () => {
        const server = storeServers.find((item) => item.id === button.dataset.cartServerId) || null;
        selectStoreServer(server);
      });
    });
    const refreshBtn = cartServerPicker.querySelector("[data-cart-servers-refresh]");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => loadStoreServers(true));
    }
  };

  const loadStoreServers = async (preserveSelection = false) => {
    if (!cartServerPicker) return;
    const previousId = preserveSelection && storeSelectedServer ? storeSelectedServer.id : null;
    storeSelectedServer = null;
    storePickerOpen = true;
    storeServers = [];
    if (!storeAccountUser || !storeAccountUser.discord?.id) {
      cartServerPicker.innerHTML = '<p class="cart-server-picker-note">Inicia sesión con Discord para elegir tu servidor.</p>';
      return;
    }
    cartServerPicker.innerHTML = '<p class="cart-server-picker-note">Cargando servidores...</p>';
    try {
      const response = await fetch('/api/my/servers');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) throw new Error(payload.error || 'Sin datos');
      if (payload.linked === false) {
        cartServerPicker.innerHTML = '<p class="cart-server-picker-note">Vinculá tu cuenta de Discord para listar tus servidores.</p>';
        return;
      }
      storeServers = payload.servers || [];
      if (previousId) {
        const fresh = storeServers.find((item) => item.id === previousId && item.hasBot);
        if (fresh) {
          storeSelectedServer = fresh;
          storePickerOpen = false;
          if (cartGuildInput) cartGuildInput.value = fresh.id;
        }
      }
      updateGuildHint();
      renderStoreServerPicker();
    } catch {
      cartServerPicker.innerHTML = '<p class="cart-server-picker-note">No pudimos cargar tus servidores. Inténtalo de nuevo.</p>';
    }
  };

  const loadStoreAccount = async () => {
    try {
      const response = await fetch('/api/me?soft=1');
      if (!response.ok) throw new Error('Sin sesión');
      const payload = await response.json();
      storeAccountUser = payload.user || null;
    } catch {
      storeAccountUser = null;
    }
    renderStoreAccount();
    refreshCheckoutFields();
    loadStoreServers();
  };

  const openCart = () => {
    cartDrawer?.classList.add('is-open');
    cartDrawer?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const closeCart = () => {
    cartDrawer?.classList.remove('is-open');
    cartDrawer?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  const renderCart = () => {
    const plan = allmightyPlans[allmightyCart.plan] || allmightyPlans.monthly;
    if (cartCount) {
      cartCount.textContent = allmightyCart.hasItem ? '1' : '0';
      cartCount.dataset.zero = String(!allmightyCart.hasItem);
    }
    if (cartEmpty) cartEmpty.hidden = allmightyCart.hasItem;
    if (cartContent) cartContent.hidden = !allmightyCart.hasItem;
    const couponBox = document.querySelector('[data-cart-coupon]');
    if (couponBox) couponBox.hidden = plan.price === 0;
    const couponPrice = plan.price > 0 && cartCoupon && cartCoupon.prices[allmightyCart.plan] ? cartCoupon.prices[allmightyCart.plan] : null;
    if (cartTotal) {
      const finalUsd = couponPrice ? couponPrice.price : plan.price;
      const local = finalUsd > 0 ? chargeFor(finalUsd) : null;
      const shown = plan.price === 0 ? '$0 USD' : local || `${finalUsd} USD`;
      if (couponPrice) {
        const before = chargeFor(couponPrice.before) || `${couponPrice.before} USD`;
        cartTotal.innerHTML = `<s>${planEsc(before)}</s> ${planEsc(shown)}`;
      } else {
        cartTotal.textContent = shown;
      }
      cartTotal.title = local ? `${finalUsd} USD al tipo de cambio de hoy` : '';
    }
    renderCouponNote();
    const payButton = document.querySelector('.cart-pay');
    if (payButton && !payButton.disabled) {
      payButton.textContent = allmightyCart.plan !== 'free' && paymentsInfo.online ? 'Pagar con Mercado Pago' : allmightyCart.plan === 'free' ? 'Empezar prueba gratis' : 'Generar código de compra';
    }
    if (cartNote) {
      cartNote.textContent = allmightyCart.plan === 'free'
        ? `${offersInfo.trialDays} días con el bot completo, sin pagar ni tarjeta. Después sigue con el plan Free.`
        : paymentsInfo.online
          ? 'Pagas con Mercado Pago y recibes tu clave de activación al confirmarse el pago.'
          : 'Se genera un código de compra al instante. El pago se coordina por ticket con el equipo y activas con la clave.';
    }
    document.querySelectorAll('[data-cart-plan]').forEach((button) => {
      button.classList.toggle('active', button.dataset.cartPlan === allmightyCart.plan);
    });
  };

  const couponInput = document.getElementById('cart-coupon');
  const couponNote = document.querySelector('[data-cart-coupon-note]');
  let couponError = '';
  function renderCouponNote() {
    if (!couponNote) return;
    let text = couponError;
    let tone = couponError ? 'is-error' : '';
    if (!text && cartCoupon) {
      const plan = allmightyPlans[allmightyCart.plan];
      if (cartCoupon.prices[allmightyCart.plan]) {
        text = `Cupón ${cartCoupon.code} aplicado: ${cartCoupon.label}.`;
        tone = 'is-ok';
      } else if (plan && plan.price > 0) {
        text = `El cupón ${cartCoupon.code} no sirve para el plan ${plan.label}.`;
        tone = 'is-error';
      }
    }
    couponNote.textContent = text;
    couponNote.hidden = !text;
    couponNote.classList.toggle('is-ok', tone === 'is-ok');
    couponNote.classList.toggle('is-error', tone === 'is-error');
  }
  const applyCoupon = async (rawCode, { quiet = false } = {}) => {
    const code = String(rawCode || '').trim().toUpperCase().replace(/\s+/g, '');
    couponError = '';
    if (!code) {
      cartCoupon = null;
      delete allmightyCart.coupon;
      saveCart();
      renderCart();
      return false;
    }
    if (couponInput) couponInput.value = code;
    try {
      const response = await fetch('/api/coupons/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, guildId: storeSelectedServer ? storeSelectedServer.id : '' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) throw new Error(result.error || 'Ese cupón no existe o ya no está activo');
      cartCoupon = { code: result.code, label: result.label, prices: result.prices || {} };
      allmightyCart.coupon = result.code;
      // Si el plan elegido no entra en el cupón, se pasa al primero que sí.
      if (!cartCoupon.prices[allmightyCart.plan]) {
        const first = Object.keys(cartCoupon.prices).find((id) => allmightyPlans[id]);
        if (first) allmightyCart.plan = first;
      }
      saveCart();
      renderCart();
      return true;
    } catch (error) {
      cartCoupon = null;
      delete allmightyCart.coupon;
      saveCart();
      if (!quiet) couponError = error.message;
      renderCart();
      return false;
    }
  };
  document.querySelector('[data-cart-coupon-apply]')?.addEventListener('click', () => applyCoupon(couponInput?.value));
  couponInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); applyCoupon(couponInput.value); }
  });
  couponInput?.addEventListener('input', () => {
    if (couponError) { couponError = ''; renderCouponNote(); }
  });

  document.querySelectorAll('[data-cart-open]').forEach((button) => {
    button.addEventListener('click', openCart);
  });

  document.querySelectorAll('[data-cart-close]').forEach((button) => {
    button.addEventListener('click', closeCart);
  });

  document.querySelector('[data-cart-remove]')?.addEventListener('click', () => {
    allmightyCart = { hasItem: false, plan: 'monthly' };
    saveCart();
    renderCart();
  });

  // Delegado: los botones de plan se vuelven a pintar con los planes de la base.
  document.addEventListener('click', (event) => {
    const cartPlan = event.target.closest('[data-cart-plan]');
    if (cartPlan) {
      allmightyCart.hasItem = true;
      allmightyCart.plan = cartPlan.dataset.cartPlan || 'monthly';
      saveCart();
      renderCart();
      return;
    }
    const planOption = event.target.closest('button[data-cart-product="allmighty"]');
    if (planOption) {
      event.preventDefault();
      allmightyCart.hasItem = true;
      allmightyCart.plan = planOption.dataset.plan || allmightyCart.plan || 'monthly';
      saveCart();
      renderCart();
      if (!storeAccountUser && cartNote) {
        cartNote.innerHTML = 'Para continuar, <a class="cart-note-link" href="/api/auth/discord?next=store">entra con Discord</a>: así eliges tu servidor.';
      }
      openCart();
    }
  });

  // Planes que el dueño guarda en la consola owner (pestaña Planes). El HTML trae los
  // de siempre como respaldo; si la web responde, se pintan los guardados.
  const planMoney = (price) => `$${Number(price || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  // Ofertas de lanzamiento (Web/lib/offers.js): prueba gratis, días de regalo y cupos OG.
  let offersInfo = { trialDays: 30, og: null };
  const giftText = (days) => {
    const d = Number(days) || 0;
    if (!d) return '';
    if (d % 30 === 0) return d === 30 ? '+1 mes de regalo' : `+${d / 30} meses de regalo`;
    return `+${d} días de regalo`;
  };
  const planTerm = (plan) => {
    if (!plan.durationDays) return plan.price ? 'Sin vencimiento' : `Prueba de ${offersInfo.trialDays} días, luego Free`;
    const gift = giftText(plan.bonusDays);
    return gift ? `${plan.durationDays} días ${gift}` : `${plan.durationDays} días`;
  };
  const applyOffers = (offers) => {
    if (offers) offersInfo = { ...offersInfo, ...offers };
    const og = offersInfo.og;
    document.querySelectorAll('[data-og-offer]').forEach((box) => { box.hidden = !(og && og.open); });
    if (!og) return;
    document.querySelectorAll('[data-og-count]').forEach((node) => { node.textContent = `Quedan ${og.remaining} de ${og.slots} cupos`; });
  };
  const planEsc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const applyPlans = (plans) => {
    if (!Array.isArray(plans) || !plans.length) return;
    Object.keys(allmightyPlans).forEach((key) => delete allmightyPlans[key]);
    plans.forEach((plan) => { allmightyPlans[plan.id] = { label: plan.name, price: Number(plan.price) || 0 }; });
    if (!allmightyPlans[allmightyCart.plan]) {
      allmightyCart.plan = (plans.find((plan) => plan.price > 0) || plans[0]).id;
      saveCart();
    }
    document.querySelectorAll('.plan-options').forEach((box) => {
      box.innerHTML = plans.map((plan) => `<button type="button" class="plan-option" data-package="Bot Allmighty" data-category="Bots / Automatización" data-cart-product="allmighty" data-plan="${planEsc(plan.id)}" aria-label="Agregar plan ${planEsc(plan.name)}, ${planEsc(plan.price)} dólares, a la bolsa"><span><b>${planEsc(plan.name)}${plan.featured ? ' <span class="badge badge-blue">Más elegido</span>' : ''}</b><small>${planEsc(planTerm(plan))}</small></span><strong>${planEsc(planMoney(plan.price))}</strong></button>`).join('');
    });
    // Aviso de la subida: el plan más corto que tenga precio de después de los OG.
    const nextRaise = plans.filter((plan) => plan.price > 0 && Number(plan.priceAfterOg) > plan.price && plan.durationDays)
      .sort((a, b) => a.durationDays - b.durationDays)[0];
    document.querySelectorAll('[data-og-after]').forEach((node) => {
      node.hidden = !nextRaise;
      if (nextRaise) node.textContent = `Al llenarse, ${nextRaise.name} pasa de ${planMoney(nextRaise.price)} a ${planMoney(nextRaise.priceAfterOg)}`;
    });
    document.querySelectorAll('.cart-plan-options').forEach((box) => {
      box.innerHTML = plans.map((plan) => `<button type="button" data-cart-plan="${planEsc(plan.id)}">${planEsc(plan.name)}<span>${planEsc(planMoney(plan.price))}</span></button>`).join('');
    });
    document.querySelectorAll('.plans[data-plans]').forEach((box) => {
      box.innerHTML = plans.map((plan) => `<article class="plan${plan.featured ? ' is-featured' : ''}">${plan.featured ? '<span class="badge badge-blue">Más elegido</span>' : ''}<h3>${planEsc(plan.name)}</h3><p class="plan-price">${planEsc(planMoney(plan.price))}</p><p class="plan-term">${planEsc(planTerm(plan))}</p><p class="plan-desc">${plan.price ? 'El bot completo: tickets, verificación, bienvenidas y más.' : `${offersInfo.trialDays} días con el bot completo; después, moderación y reglas gratis.`}</p><a href="store#allmighty" class="btn ${plan.featured ? 'btn-primary' : 'btn-tinted'}">${plan.price ? 'Elegir' : 'Probar gratis'}</a></article>`).join('');
    });
    renderCart();
  };
  // Tarjeta de promoción de la tienda (consola owner → Cupones).
  const promoBox = document.querySelector('[data-store-promo]');
  let promoTimer = null;
  const promoLeft = (endsAt) => {
    const ms = Date.parse(endsAt) - Date.now();
    if (!(ms > 0)) return '';
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const minutes = Math.max(1, Math.floor((ms % 3600000) / 60000));
    if (days >= 1) return `Termina en ${days} ${days === 1 ? 'día' : 'días'} y ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    if (hours >= 1) return `Termina en ${hours} ${hours === 1 ? 'hora' : 'horas'} y ${minutes} min`;
    return `Termina en ${minutes} min`;
  };
  // Sin promoción encendida, la tarjeta muestra el texto de siempre (el del HTML).
  const promoDefaults = {
    tag: 'Ofertas de lanzamiento',
    title: 'Empieza gratis y paga menos.',
    text: 'Prueba Allmighty 30 días, suma meses de regalo y congela tu precio.',
  };
  // Enganches: días de prueba y meses de regalo salen de /api/plans.
  const applyHooks = (plans) => {
    if (!promoBox) return;
    const trial = promoBox.querySelector('[data-hook-trial]');
    if (trial) trial.textContent = `${offersInfo.trialDays} días gratis`;
    const withGift = (Array.isArray(plans) ? plans : []).filter((plan) => Number(plan.bonusDays) > 0 && Number(plan.price) > 0);
    const row = promoBox.querySelector('[data-hook-gift-row]');
    if (row) row.hidden = !withGift.length;
    if (!withGift.length) return;
    const best = Math.max(...withGift.map((plan) => Number(plan.bonusDays)));
    const months = (d) => (d % 30 === 0 ? (d === 30 ? '1 mes' : `${d / 30} meses`) : `${d} días`);
    promoBox.querySelector('[data-hook-gift]').textContent = `Hasta ${months(best)} de regalo`;
    promoBox.querySelector('[data-hook-gift-detail]').textContent = withGift.map((plan) => `${plan.name} +${months(Number(plan.bonusDays))}`).join(' · ');
  };
  promoBox?.querySelector('[data-hook-try]')?.addEventListener('click', () => {
    allmightyCart.hasItem = true;
    allmightyCart.plan = allmightyPlans.free ? 'free' : allmightyCart.plan;
    saveCart();
    renderCart();
    openCart();
  });
  const applyPromo = (promo) => {
    if (!promoBox) return;
    const couponBox = promoBox.querySelector('[data-promo-coupon]');
    const ends = promoBox.querySelector('[data-promo-ends]');
    const text = promoBox.querySelector('[data-promo-text]');
    const title = promoBox.querySelector('[data-promo-title]');
    clearInterval(promoTimer);
    if (!promo) {
      promoBox.querySelector('[data-promo-tag]').textContent = promoDefaults.tag;
      title.textContent = promoDefaults.title;
      title.removeAttribute('data-no-translate');
      text.textContent = promoDefaults.text;
      text.hidden = false;
      ends.hidden = true;
      couponBox.hidden = true;
      return;
    }
    promoBox.querySelector('[data-promo-tag]').textContent = 'Promoción';
    // El texto lo escribe el dueño en la consola: no pasa por el traductor.
    title.textContent = promo.title;
    title.setAttribute('data-no-translate', '');
    text.textContent = promo.text || '';
    text.setAttribute('data-no-translate', '');
    text.hidden = !promo.text;
    const tick = () => {
      const left = promo.endsAt ? promoLeft(promo.endsAt) : '';
      if (promo.endsAt && !left) { clearInterval(promoTimer); applyPromo(null); return; }
      ends.textContent = left;
      ends.hidden = !left;
    };
    tick();
    if (promo.endsAt) promoTimer = setInterval(tick, 30000);
    couponBox.hidden = !promo.coupon;
    if (promo.coupon) {
      promoBox.querySelector('[data-promo-code]').textContent = promo.coupon.code;
      const plans = Array.isArray(promo.coupon.plans) && promo.coupon.plans.length
        ? promo.coupon.plans.map((id) => (allmightyPlans[id] ? allmightyPlans[id].label : id)).join(', ')
        : '';
      promoBox.querySelector('[data-promo-off]').textContent = plans ? `${promo.coupon.label} · ${plans}` : promo.coupon.label;
      promoBox.querySelector('[data-promo-use]').textContent = promo.cta || 'Usar cupón';
      promoBox.dataset.code = promo.coupon.code;
    }
  };
  promoBox?.querySelector('[data-promo-use]')?.addEventListener('click', async () => {
    const code = promoBox.dataset.code;
    if (!code) return;
    allmightyCart.hasItem = true;
    if (!allmightyPlans[allmightyCart.plan] || allmightyPlans[allmightyCart.plan].price === 0) {
      const paid = Object.keys(allmightyPlans).find((id) => allmightyPlans[id].price > 0);
      if (paid) allmightyCart.plan = paid;
    }
    saveCart();
    await applyCoupon(code);
    openCart();
  });
  promoBox?.querySelector('[data-promo-copy]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(promoBox.dataset.code || '');
      button.classList.add('is-copied');
      setTimeout(() => button.classList.remove('is-copied'), 1400);
    } catch {}
  });

  fetch('/api/plans', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (data?.payments) paymentsInfo = { ...paymentsInfo, ...data.payments };
      applyOffers(data?.offers);
      applyPlans(data?.plans);
      applyHooks(data?.plans);
      applyPromo(data?.promo || null);
      // Cupón guardado en la bolsa: se vuelve a comprobar (pudo vencer o agotarse).
      if (allmightyCart.coupon) applyCoupon(allmightyCart.coupon, { quiet: true });
    })
    .catch(() => {});

  if (cartDiscord) {
    fetch('/api/auth/discord/config')
      .then((response) => response.json())
      .then((payload) => { if (payload.enabled !== true) cartDiscord.hidden = true; })
      .catch(() => {});
    cartDiscord.addEventListener('click', () => {
      window.location.href = '/api/auth/discord?next=store';
    });
  }

  cartLogout?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    storeAccountUser = null;
    storeServers = [];
    renderStoreAccount();
    refreshCheckoutFields();
    loadStoreServers();
  });

  cartCheckout?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!allmightyCart.hasItem) {
      openCart();
      return;
    }
    if (!storeAccountUser || !storeAccountUser.discord?.id) {
      if (cartNote) {
        cartNote.innerHTML = 'Inicia sesión con Discord para continuar: <a class="cart-note-link" href="/api/auth/discord?next=store">Entrar con Discord</a>';
      }
      return;
    }
    if (!storeSelectedServer) {
      if (cartGuildHint) {
        cartGuildHint.textContent = storeServers.length
          ? 'Elige un servidor que tenga el bot activo para continuar.'
          : 'No administras ningún servidor de Discord. Necesitas ser dueño o tener el permiso Administrar servidor.';
        cartGuildHint.classList.add('is-warning');
        cartGuildHint.classList.remove('is-ok');
      }
      return;
    }
    if (!cartCheckout.checkValidity()) {
      cartCheckout.reportValidity();
      return;
    }

    const submitButton = cartCheckout.querySelector('.cart-pay');
    const originalText = submitButton?.textContent || 'Generar código';
    const formData = new FormData(cartCheckout);
    const payload = {
      name: String(storeAccountUser.discord.username || '').trim(),
      email: String(formData.get('email') || '').trim(),
      desiredUsername: String(storeAccountUser.discord.username || '').trim(),
      buyerDiscordId: String(storeAccountUser.discord.id || '').trim(),
      guildId: String(cartGuildInput?.value || storeSelectedServer.id || '').trim(),
      guildName: String(storeSelectedServer.name || '').trim(),
      message: String(formData.get('message') || '').trim(),
      packageName: 'Bot Allmighty',
      plan: allmightyCart.plan,
      coupon: cartCoupon && cartCoupon.prices[allmightyCart.plan] ? cartCoupon.code : '',
      acceptTerms: formData.get('acceptTerms') === 'on'
    };

    // Sin vuelta automática (web sin https) MercadoPago se abre en otra pestaña. Se abre ya,
    // dentro del clic, para que el navegador no la bloquee; luego se le pone la dirección.
    const payInNewTab = paymentsInfo.online && !paymentsInfo.autoReturn && allmightyCart.plan !== 'free';
    let payWindow = payInNewTab ? window.open('', '_blank') : null;
    try {
      if (submitButton) {
        submitButton.textContent = paymentsInfo.online && allmightyCart.plan !== 'free' ? 'Preparando el pago…' : allmightyCart.plan === 'free' ? 'Preparando tu clave…' : 'Generando código...';
        submitButton.disabled = true;
      }
      if (cartNote) cartNote.textContent = allmightyCart.plan === 'free'
        ? 'Preparando tu clave de activación…'
        : 'Generando tu código de compra…';
      const response = await fetch('/api/checkout/allmighty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (result.code === 'coupon') {
        cartCoupon = null;
        delete allmightyCart.coupon;
        saveCart();
        couponError = result.error || 'Ese cupón no se pudo usar.';
        renderCart();
      }
      if (!response.ok || result.success === false) throw new Error(result.error || 'No pudimos preparar tu compra. Intenta de nuevo.');
      if (result.checkoutUrl) {
        sessionStorage.setItem('ALLMIGHTY-allmighty-result', JSON.stringify({ orderId: result.orderId, online: true, guildId: payload.guildId, plan: result.plan }));
        allmightyCart = { hasItem: false, plan: 'free' };
        saveCart();
        if (payWindow && !payWindow.closed) {
          payWindow.opener = null;
          payWindow.location.href = result.checkoutUrl;
          window.location.href = `allmighty-success?orderId=${encodeURIComponent(result.orderId)}&waiting=1`;
        } else {
          window.location.href = result.checkoutUrl;
        }
        return;
      }
      if (payWindow && !payWindow.closed) { payWindow.close(); payWindow = null; }
      if (result.free) {
        // Plan Free: la clave ALM ya está lista; la página de resultado la muestra tapada.
        allmightyCart = { hasItem: false, plan: 'free' };
        saveCart();
        window.location.href = `allmighty-success?orderId=${encodeURIComponent(result.orderId)}`;
        return;
      }
      if (result.purchaseCode) {
        sessionStorage.setItem('ALLMIGHTY-allmighty-result', JSON.stringify({
          orderId: result.orderId,
          purchaseCode: result.purchaseCode,
          purchaseNumber: result.purchase?.purchaseNumber || '',
          supportUrl: result.supportUrl,
          botInviteUrl: result.botInviteUrl,
          guildId: payload.guildId,
          plan: result.plan,
          paymentWarning: result.paymentWarning || ''
        }));
        allmightyCart = { hasItem: false, plan: 'free' };
        saveCart();
        window.location.href = `allmighty-success?orderId=${encodeURIComponent(result.orderId)}&code=${encodeURIComponent(result.purchaseCode)}`;
        return;
      }
      throw new Error('Respuesta inesperada del servidor. Intenta de nuevo.');
    } catch (error) {
      if (payWindow && !payWindow.closed) payWindow.close();
      if (cartNote) cartNote.textContent = error.message || 'No pudimos generar el codigo.';
      if (submitButton) {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
      }
    }
  });

  renderCart();
  loadStoreAccount();

  // Ventana de contacto: solo envía mensajes (/api/contact). El bot Allmighty se compra por la bolsa.
  if (contactModal) {
    const contactForm = document.getElementById('ALLMIGHTYContactForm');
    const typePills = Array.from(contactModal.querySelectorAll('[data-type]'));
    const views = contactModal.querySelectorAll('[data-cf-view]');
    const packageBox = contactModal.querySelector('[data-cf-package]');
    const packageNameEl = contactModal.querySelector('[data-cf-package-name]');
    const errorBox = contactModal.querySelector('[data-cf-error]');
    const submitBtn = contactForm.querySelector('.submit-btn');
    const messageField = contactForm.elements.message;
    const t = (text) => (window.xhPrefs && window.xhPrefs.t ? window.xhPrefs.t(text) : text);
    let lastFocus = null;

    const showView = (name) => views.forEach((view) => { view.hidden = view.dataset.cfView !== name; });
    const pickType = (value) => {
      const match = typePills.find((pill) => pill.dataset.type === value) || typePills[0];
      typePills.forEach((pill) => pill.setAttribute('aria-pressed', String(pill === match)));
    };
    const setError = (text) => { errorBox.textContent = text || ''; errorBox.hidden = !text; };

    const openContact = (packageName, category) => {
      lastFocus = document.activeElement;
      showView('form');
      setError('');
      contactForm.dataset.packageName = packageName || '';
      packageBox.hidden = !packageName;
      packageNameEl.textContent = packageName || '';
      if (category) pickType(category);
      messageField.placeholder = t(packageName ? 'Cuéntanos qué necesitas: la idea, las secciones o funciones y para cuándo.' : 'Qué quieres construir y para cuándo');
      // Con sesión iniciada, el correo y el nombre ya los conocemos.
      if (storeAccountUser) {
        if (!contactForm.elements.email.value && storeAccountUser.email) contactForm.elements.email.value = storeAccountUser.email;
        if (!contactForm.elements.name.value) contactForm.elements.name.value = storeAccountUser.discord?.globalName || storeAccountUser.username || '';
      }
      contactModal.classList.add('is-open');
      contactModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const first = [contactForm.elements.name, contactForm.elements.email, messageField].find((el) => !el.value) || messageField;
      setTimeout(() => first.focus({ preventScroll: true }), 220);
    };

    const closeContactModal = () => {
      contactModal.classList.remove('is-open');
      contactModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (window.location.hash === '#contact') history.replaceState(null, '', window.location.pathname + window.location.search);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };

    // Enlaces a #contact y botones de paquetes (menos el bot Allmighty, que va a la bolsa).
    document.querySelectorAll('a[href*="#contact"], button[data-package]:not([data-cart-product="allmighty"])').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        openContact(link.getAttribute('data-package') || '', link.getAttribute('data-category') || '');
      });
    });
    if (window.location.hash === '#contact') openContact('', '');

    contactModalClose?.addEventListener('click', closeContactModal);
    contactModalOverlay?.addEventListener('click', closeContactModal);
    contactModal.querySelectorAll('[data-cf-close]').forEach((button) => button.addEventListener('click', closeContactModal));
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && contactModal.classList.contains('is-open')) closeContactModal();
    });
    typePills.forEach((pill) => pill.addEventListener('click', () => pickType(pill.dataset.type)));

    contactForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setError('');
      const payload = {
        name: contactForm.elements.name.value.trim(),
        email: contactForm.elements.email.value.trim(),
        projectType: contactModal.querySelector('[data-type][aria-pressed="true"]')?.dataset.type || 'Otro',
        message: messageField.value.trim(),
        packageName: contactForm.dataset.packageName || '',
        website: contactForm.elements.website.value || '',
      };
      if (payload.name.length < 2) { contactForm.elements.name.focus(); return setError(t('Escribe tu nombre')); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email)) { contactForm.elements.email.focus(); return setError(t('Revisa tu correo')); }
      if (payload.message.length < 10) { messageField.focus(); return setError(t('Cuéntanos un poco más (mínimo 10 caracteres)')); }
      // Lo que eligió en la tienda viaja también en el texto, por si se lee desde el aviso de Discord.
      if (payload.packageName) payload.message = `[${payload.packageName}] ${payload.message}`;
      const label = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = t('Enviando…');
      try {
        const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success === false) throw new Error(result.error || 'No pudimos enviar tu mensaje. Intenta de nuevo.');
        contactModal.querySelector('[data-cf-email]').textContent = payload.email;
        showView('done');
        contactModal.querySelector('[data-cf-view="done"] [data-cf-close]')?.focus({ preventScroll: true });
        messageField.value = '';
        contactForm.dataset.packageName = '';
      } catch (error) {
        setError(t(error.message || 'No pudimos enviar tu mensaje. Intenta de nuevo.'));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = label;
      }
    });
  }
});

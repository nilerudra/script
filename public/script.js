(function () {
  console.log("Universal Checkout SDK loaded");

  const script = document.currentScript;
  const domain = new URL(script.src).origin;

  console.log("domain: ", domain);

  init();

  function init() {
    interceptClicks();
    observeDOM();
    initialScan();
  }

  function getCookie(name) {
    const match = document.cookie.match(
      new RegExp("(^| )" + name + "=([^;]+)"),
    );
    return match ? decodeURIComponent(match[2]) : null;
  }

  function getUserId() {
    let userId = localStorage.getItem("syne_user_id");

    if (!userId) {
      userId = "syne_" + Math.random().toString(36).slice(2);
      localStorage.setItem("syne_user_id", userId);
    }

    return userId;
  }

  function getSessionId() {
    let sessionId = localStorage.getItem("syne_session");

    if (!sessionId) {
      sessionId = "sess_" + Math.random().toString(36).slice(2);
      localStorage.setItem("syne_session", sessionId);
    }

    return sessionId;
  }

  function getWalletBalance() {
    const wallet = localStorage.getItem("syne_wallet");

    return wallet ? Number(wallet) : 0;
  }

  // check if an element is a checkout trigger
  function isCheckoutTrigger(el) {
    if (!el) return false;

    const text = el.innerText?.toLowerCase() || "";

    return (
      el.name === "checkout" ||
      el.getAttribute("href") === "/checkout" ||
      text.includes("checkout") ||
      el.classList.contains("shopify-payment-button__button")
    );
  }

  // Global click interceptor
  function interceptClicks() {
    document.addEventListener("click", async function (e) {
      const target = e.target.closest("button, a");

      if (!isCheckoutTrigger(target)) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        await startCheckout();
      } catch (err) {
        console.error("Fallback to native checkout:", err);
        window.location.href = "/checkout";
      }
    });
  }

  // actively watch for dynamically added elements
  function observeDOM() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            attachListener(node);
          }
        });
      });
    });

    // Observes entire document
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function attachListener(root) {
    const elements = root.querySelectorAll("button, a");

    elements.forEach((el) => {
      if (el.dataset.checkoutBound) return;

      const text = el.innerText?.toLowerCase() || "";

      const isCheckout =
        el.name === "checkout" ||
        el.getAttribute("href") === "/checkout" ||
        text.includes("checkout");

      if (!isCheckout) return;

      el.dataset.checkoutBound = "true";

      el.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        startCheckout();
      });
    });
  }

  // scan initial DOM
  function initialScan() {
    attachListener(document);
  }

  // will fetch cart data
  async function getCart() {
    try {
      const res = await fetch(window.Shopify.routes.root + "cart.js", {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });

      if (!res.ok) throw new Error("Cart fetch failed");

      const cart = await res.json();

      return {
        raw: cart,
        parsed: {
          items: cart.items.map((item) => ({
            variant_id: item.variant_id,
            name: item.product_title,
            image: item.image,
            quantity: item.quantity,
            price: item.price / 100,
          })),
          total_price: cart.total_price / 100,
        },
      };
    } catch (err) {
      console.warn("Cart fetch failed, using fallback");

      return {
        raw: null,
        parsed: {
          items: [],
          total_price: 0,
        },
      };
    }
  }

  async function fetchWithTimeout(url, options, timeout = 7000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(id);
    }
  }

  // sends cart data to backend server, it will return the Checkout URL
  async function createCheckoutSession(cart) {
    const payload = {
      user: {
        userId: getUserId(),
      },
      session: {
        sessionId: getSessionId(),
        timestamp: Date.now(),
      },
      cart,
      context: "checkout",
    };

    const res = await fetchWithTimeout(`/apps/synegrow/checkout/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Session creation failed");

    return await res.json();
  }

  function trackEvent(type, data = {}) {
    try {
      fetch(`/apps/synegrow/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: getUserId(),
          type,
          data,
          timestamp: Date.now(),
        }),
      });
    } catch (err) {
      console.warn("Tracking failed");
    }
  }

  // main checkout flow
  async function startCheckout() {
    try {
      const isVerified = getCookie("syne_auth");
      const phone = getCookie("syne_phone");

      console.log({ isVerified });
      console.log({ phone });

      // Skip OTP for returning user
      if (isVerified === "true" && phone) {
        console.log("Returning user → skipping OTP");
        window.location.href = "/checkout";
        return;
      }

      // Wallet fallback
      if (getWalletBalance() <= -5000) {
        window.location.href = "/checkout";
        return;
      }

      // fetch cart data
      const cart = await getCart();

      trackEvent("checkout_clicked", {
        value: cart.parsed.total_price,
      });

      // create checkout session from backend
      const session = await createCheckoutSession(cart);

      if (session.useNativeCheckout) {
        window.location.href = "/checkout";
        return;
      }

      const encodedCart = encodeURIComponent(JSON.stringify(cart.parsed));

      const checkoutUrl = `${session.url}&cart=` + encodedCart;

      openCheckoutPopup(checkoutUrl);
    } catch (err) {
      console.error("Checkout error:", err); // handles error
    }
  }
})();

function openCheckoutPopup(url) {
  // Prevent multiple popups
  if (document.getElementById("custom-checkout-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "custom-checkout-overlay";

  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.zIndex = "999999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.style.width = "420px";
  iframe.style.height = "90%";
  iframe.style.border = "none";
  iframe.style.borderRadius = "16px";
  iframe.style.background = "#fff";
  iframe.style.boxShadow = "0 10px 40px rgba(0,0,0,0.3)";

  // Close popup
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });

  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
}

// https://streetmuse.in/cart/add.js
// https://fastrr-boost-ui.pickrr.com/static/js/main.2ccc86482eddeeb85030.js
// https://fastrr-boost-ui.pickrr.com/static/js/342.591e518c.chunk.js

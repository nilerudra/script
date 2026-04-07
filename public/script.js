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

  // Global click interceptor
  async function interceptClicks() {
    document.addEventListener("click", async function (e) {
      const target = e.target.closest(
        'button[name="checkout"], a[href="/checkout"], .shopify-payment-button__button',
      );

      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        await startCheckout();
      } catch (err) {
        console.error(err);
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

  function initialScan() {
    attachListener(document);
  }

  // will fetch cart data
  async function getCart() {
    try {
      const res = await fetch(window.Shopify.routes.root + "cart.js", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      if (!res.ok) {
        throw new Error("Cart fetch failed");
      }

      const cart = await res.json();

      console.log("Real cart:", cart);

      return {
        items: cart.items.map((item) => ({
          variant_id: item.variant_id,
          name: item.product_title,
          image: item.image,
          quantity: item.quantity,
          price: item.price / 100,
        })),
        total_price: cart.total_price / 100,
      };
    } catch (err) {
      console.warn("Using mock cart (local/dev mode)");

      // 🔥 Fallback mock data
      return {
        items: [
          {
            variant_id: 12345,
            name: "Test Product",
            image: "https://picsum.photos/200",
            quantity: 2,
            price: 500,
          },
        ],
        total_price: 1000,
      };
    }
  }

  async function generateHash(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // sends cart data to backend server, it will return the Checkout URL
  async function createCheckoutSession(cart) {
    const payload = {
      cart,
      shop: "fake-shop.myshopify.com",
      timestamp: Date.now(),
    };

    // 🔥 Create signature (simple hash)
    const raw = JSON.stringify(payload);

    const signature = await generateHash(raw);

    const res = await fetch(`${domain}/checkout/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature": signature,
      },
      body: raw,
    });

    return await res.json();

    // console.log("Mock Checkout Session: ", cart);

    // await new Promise((resolve) => setTimeout(resolve, 800));

    // console.log({ domain });

    // const res = await fetch(`${domain}/checkout.html`, {
    //   method: "GET",
    //   headers: {
    //     Accept: "application/json",
    //   },
    //   credentials: "same-origin",
    // });
    // console.log(res);

    // return {
    //   checkoutUrl: "http://127.0.0.1:5500/checkout.html?session=mock123",
    // };
  }

  // main checkout flow
  async function startCheckout() {
    try {
      // fetch cart data
      const cart = await getCart();

      // create checkout session from backend
      const session = await createCheckoutSession(cart);

      const encodedCart = encodeURIComponent(JSON.stringify(cart));

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

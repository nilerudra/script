(function () {
  console.log("Universal Checkout SDK loaded");

  init();

  function init() {
    interceptClicks();
    observeDOM();
    initialScan();
  }

  // Global click interceptor
  function interceptClicks() {
    document.addEventListener("click", function (e) {
      // Finds Checkout element
      const target = e.target.closest(
        'button[name="checkout"], a[href="/checkout"]',
      );

      // ignore if not checkout
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      // starts custom checkout flow
      startCheckout();
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
    console.log("Using mock cart");

    fetch(window.Shopify.routes.root + "cart.js", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        console.log(response);
        return response.json();
      })
      .then((cart) => {
        console.log("Cart object:", cart);
        console.log("Cart items:", cart.items);
      })
      .catch((error) => {
        console.error("Error fetching cart:", error);
      });

    return {
      items: [
        {
          variant_id: 12345,
          name: "TShirt",
          Image: "https://picsum.photos/536/354",
          quantity: 2,
          price: 500,
        },
      ],
      total_price: 1000,
    };

    // const res = await fetch("/cart.js");

    // return await res.json();
  }

  // sends cart data to backend server, it will return the Checkout URL
  async function createCheckoutSession(cart) {
    // const res = await fetch("https://api.synegrow.com/checkout/session", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     shop: window.location.hostname,
    //     cart: cart,
    //   }),
    // });

    // return await res.json();

    console.log("Mock Checkout Session: ", cart);

    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
      checkoutUrl: "http://127.0.0.1:5500//checkout.html?session=mock123",
    };
  }

  // main checkout flow
  async function startCheckout() {
    try {
      // fetch cart data
      const cart = await getCart();

      // create checkout session from backend
      const session = await createCheckoutSession(cart);

      const encodedCart = encodeURIComponent(JSON.stringify(cart));

      const checkoutUrl = `${session.checkoutUrl}&cart=` + encodedCart;

      // redirect to hosted backend
      // redirectToCheckout(session.checkoutUrl);
      // redirectToCheckout(checkoutUrl);
      openCheckoutPopup(checkoutUrl);
    } catch (err) {
      console.error("Checkout error:", err); // handles error
    }
  }

  // redirect user to hosted checkout page
  function redirectToCheckout(url) {
    console.log("Redirecting to:", url);

    window.location.href = url;
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

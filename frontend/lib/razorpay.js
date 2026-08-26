const CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";

let checkoutPromise;

export function loadRazorpayCheckout() {
  if (typeof window === "undefined") return Promise.reject(new Error("Razorpay Checkout requires a browser."));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (checkoutPromise) return checkoutPromise;

  checkoutPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CHECKOUT_URL}"]`);
    const script = existing || document.createElement("script");
    const fail = () => {
      checkoutPromise = null;
      reject(new Error("Razorpay Checkout could not be loaded. Check your connection and try again."));
    };
    script.addEventListener("load", () => window.Razorpay ? resolve(window.Razorpay) : fail(), { once: true });
    script.addEventListener("error", fail, { once: true });
    if (!existing) {
      script.src = CHECKOUT_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return checkoutPromise;
}

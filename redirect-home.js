(() => {
  const ShopContext =
    globalThis.ShopCategoryContext ||
    (typeof require === "function" ? require("./shop-context.js") : null);

  function categoryTarget(locationLike) {
    const origin =
      locationLike?.origin ||
      `${locationLike?.protocol || "https:"}//${locationLike?.hostname || ""}`;
    return new URL("/category.htm", origin).href;
  }

  function getHomeRedirectDecision(locationLike, documentLike) {
    if (!ShopContext?.isCandidateHomeLocation(locationLike)) {
      return { redirect: false, waitForDocument: false, reason: "not-shop-home" };
    }

    const context = ShopContext.classifyShopContext(locationLike, documentLike);
    if (context.supported) {
      return {
        redirect: true,
        waitForDocument: false,
        target: categoryTarget(locationLike),
        context,
      };
    }

    return {
      redirect: false,
      waitForDocument: context.hostType === "custom" && !documentLike,
      reason: context.reason,
      context,
    };
  }

  function bootstrap(windowLike) {
    const initial = getHomeRedirectDecision(windowLike.location, null);
    if (initial.redirect) {
      windowLike.location.replace(initial.target);
      return;
    }
    if (!initial.waitForDocument) {
      return;
    }

    let redirected = false;
    const attempt = () => {
      if (redirected) {
        return true;
      }
      const decision = getHomeRedirectDecision(
        windowLike.location,
        windowLike.document
      );
      if (!decision.redirect) {
        return false;
      }
      redirected = true;
      windowLike.location.replace(decision.target);
      return true;
    };
    const start = () => {
      if (attempt()) {
        return;
      }
      windowLike.setTimeout(attempt, 600);
      windowLike.setTimeout(attempt, 1800);
    };

    if (windowLike.document.readyState === "loading") {
      windowLike.document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  }

  const api = { getHomeRedirectDecision };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else if (typeof window !== "undefined" && ShopContext) {
    bootstrap(window);
  }
})();

(() => {
  const shopHostPatterns = [
    /^jiyoujia\d+\.jiyoujia\.com$/,
    /^shop\d+\.taobao\.com$/,
  ];
  const homePaths = new Set(["/", "/index.htm"]);
  const isSupportedShop = shopHostPatterns.some((pattern) =>
    pattern.test(location.hostname)
  );

  if (
    !isSupportedShop ||
    !homePaths.has(location.pathname)
  ) {
    return;
  }

  location.replace(new URL("/category.htm", location.origin).href);
})();

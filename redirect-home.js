(() => {
  const shopHostPattern = /^jiyoujia\d+\.jiyoujia\.com$/;
  const homePaths = new Set(["/", "/index.htm"]);

  if (
    !shopHostPattern.test(location.hostname) ||
    !homePaths.has(location.pathname)
  ) {
    return;
  }

  location.replace(new URL("/category.htm", location.origin).href);
})();

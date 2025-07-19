
(function () {
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);

  if (isMobile) {
    document.body.classList.add("device-mobile");
  } else {
    document.body.classList.add("device-desktop");
  }
})();

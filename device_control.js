
(function () {
  /**
   * 偵測使用者裝置型態：mobile / tablet / desktop
   */
  function detectDeviceType() {
    const width = window.innerWidth;
    const ua = navigator.userAgent.toLowerCase();

    if (/mobi|android|iphone/.test(ua) || width <= 767) {
      return 'mobile';
    } else if (/ipad|tablet/.test(ua) || (width > 767 && width <= 1024)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * 套用 device class 到 body
   */
  function applyDeviceClass() {
    const type = detectDeviceType();

    // 移除舊的裝置 class
    document.body.classList.remove('mobile', 'tablet', 'desktop');

    // 加入新的
    document.body.classList.add(type);

    // 可選：console log 顯示
    console.log(`[Device Detector] 已套用類型：${type}`);
  }

  /**
   * 初次載入與 resize 變更時都執行
   */
  window.addEventListener('DOMContentLoaded', applyDeviceClass);
  window.addEventListener('resize', () => {
    // 若寬度變更超過閾值再重新套用
    clearTimeout(window.__resizeTimeout);
    window.__resizeTimeout = setTimeout(applyDeviceClass, 200);
  });
})();

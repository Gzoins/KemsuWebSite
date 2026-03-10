// loader.js - Система загрузки и спиннеров
(function() {
  'use strict';

  // Глобальный спиннер
  let globalSpinner = null;
  let globalOverlay = null;
  let requestCount = 0;

  // Создаем элементы спиннера
  function createSpinner() {
    if (globalSpinner) return;

    // Оверлей
    globalOverlay = document.createElement('div');
    globalOverlay.className = 'loader-overlay';
    globalOverlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
      transition: opacity 0.3s ease;
    `;

    // Спиннер
    globalSpinner = document.createElement('div');
    globalSpinner.className = 'loader-spinner';
    globalSpinner.style.cssText = `
      width: 60px;
      height: 60px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid #fff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;

    // Текст
    const text = document.createElement('div');
    text.className = 'loader-text';
    text.textContent = 'Загрузка...';
    text.style.cssText = `
      position: absolute;
      top: 80px;
      color: white;
      font-size: 14px;
      opacity: 0.8;
    `;

    globalSpinner.appendChild(text);
    globalOverlay.appendChild(globalSpinner);
    document.body.appendChild(globalOverlay);
  }

  // Показать глобальный спиннер
  function showGlobalLoader() {
    createSpinner();
    requestCount++;
    globalOverlay.style.display = 'flex';
    document.body.style.pointerEvents = 'none';
  }

  // Скрыть глобальный спиннер
  function hideGlobalLoader() {
    requestCount = Math.max(0, requestCount - 1);
    if (requestCount === 0) {
      globalOverlay.style.opacity = '0';
      setTimeout(() => {
        globalOverlay.style.display = 'none';
        document.body.style.pointerEvents = 'auto';
        globalOverlay.style.opacity = '1';
      }, 300);
    }
  }

  // Показать спиннер внутри элемента
  function showElementLoader(element) {
    if (!element) return;

    // Проверяем, есть ли уже спиннер
    const existing = element.querySelector('.element-loader');
    if (existing) return;

    const loader = document.createElement('div');
    loader.className = 'element-loader';
    loader.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255, 255, 255, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      border-radius: 8px;
    `;

    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 32px;
      height: 32px;
      border: 3px solid rgba(0, 0, 0, 0.1);
      border-top: 3px solid var(--accent, #2563eb);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    `;

    loader.appendChild(spinner);
    element.style.position = 'relative';
    element.appendChild(loader);
  }

  // Скрыть спиннер внутри элемента
  function hideElementLoader(element) {
    if (!element) return;
    const loader = element.querySelector('.element-loader');
    if (loader) {
      loader.remove();
    }
  }

  // Декоратор для асинхронных функций
  function withLoader(fn, options = {}) {
    return async function(...args) {
      const element = options.element || null;
      const global = options.global !== false;

      try {
        if (global) showGlobalLoader();
        if (element) showElementLoader(element);

        const result = await fn.apply(this, args);
        return result;
      } finally {
        if (global) hideGlobalLoader();
        if (element) hideElementLoader(element);
      }
    };
  }

  // Автоматическая обертка fetch
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    showGlobalLoader();
    
    return originalFetch.apply(this, args)
      .finally(() => {
        hideGlobalLoader();
      });
  };

  // Экспорт в глобальный объект
  window.kemguLoader = {
    show: showGlobalLoader,
    hide: hideGlobalLoader,
    showElement: showElementLoader,
    hideElement: hideElementLoader,
    withLoader: withLoader
  };

  // Добавляем CSS анимацию если её нет
  if (!document.querySelector('#loader-styles')) {
    const style = document.createElement('style');
    style.id = 'loader-styles';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .loader-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
        transition: opacity 0.3s ease;
      }
      
      .loader-spinner {
        width: 60px;
        height: 60px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-top: 4px solid #fff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }
      
      .loader-text {
        position: absolute;
        top: 80px;
        color: white;
        font-size: 14px;
        opacity: 0.8;
      }
      
      .element-loader {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        border-radius: 8px;
      }
    `;
    document.head.appendChild(style);
  }

  // Инициализация
  createSpinner();

})();
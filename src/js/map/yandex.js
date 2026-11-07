// Загрузка JavaScript API Яндекс Карт v3.
// Ключ берётся из .env (VITE_YANDEX_MAPS_KEY). Без ключа API не загрузится.

const KEY = import.meta.env.VITE_YANDEX_MAPS_KEY;

let loading;

export function hasMapsKey() {
  return Boolean(KEY);
}

export function loadYandexMaps() {
  if (!KEY) return Promise.reject(new Error('Нет ключа: заполни VITE_YANDEX_MAPS_KEY в .env и перезапусти npm run dev'));
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(KEY)}&lang=ru_RU`;
    script.onload = () => window.ymaps3.ready.then(() => resolve(window.ymaps3), reject);
    script.onerror = () => reject(new Error('API Яндекс Карт не загрузилось: проверь ключ, ограничение по Referer и сеть'));
    document.head.append(script);
  });
  return loading;
}

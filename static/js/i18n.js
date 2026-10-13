// UK / EN dictionary. Static text uses data-i18n="key" (or data-i18n-attr="attr:key;attr:key") in index.html.
const DICT = {
  en: {
    'app.title': 'Handwriting recognition',
    'side.model': 'Model', 'side.stroke': 'Stroke width', 'side.symbols': 'Symbols', 'mode.letters': 'Letters', 'mode.digits': 'Digits',
    'backend.server': 'Server', 'backend.browser': 'Browser',
    'conn.unknown': 'Connecting', 'conn.on': 'Server online', 'conn.off': 'Server offline',
    'theme.toggle': 'Switch theme',
    'kpi.inference': 'Inference', 'kpi.median': 'Median latency', 'kpi.p95': 'P95 latency', 'kpi.count': 'Recognitions',
    'unit.ms': 'ms',
    'canvas.title': 'Canvas', 'canvas.label': 'Label',
    'btn.undo': 'Undo', 'btn.clear': 'Clear', 'btn.save': 'Save sample',
    'pred.title': 'Prediction', 'pred.input': 'Model input', 'pred.empty': 'Draw a symbol',
    'latency.title': 'Latency', 'latency.sub': 'pointermove to painted frame', 'latency.empty': 'No measurements yet',
    'history.title': 'History', 'history.empty': 'No recognitions yet',
    'kind.letter': 'Letter', 'kind.digit': 'Digit',
    'help.title': 'How to use', 'help.keys': 'Shortcuts',
    'help.s1': 'Draw a letter or a digit. The result updates with every stroke.',
    'help.s2': 'Switch the model between Server and Browser to compare latency.',
    'help.s3': 'Check the label and save the sample to build your own dataset.',
    'side.input': 'Input', 'input.camera': 'Hand tracking', 'input.camera_sub': 'Camera · pinch to draw',
    'cam.loading': 'Loading hand tracking', 'cam.nohand': 'Show your hand', 'cam.up': 'Pen up', 'cam.down': 'Drawing', 'cam.clearing': 'Clearing',
    'cam.hint': 'Pinch to draw. Hold a fist for one second to clear.',
    'help.gestures': 'Hand gestures',
    'help.g1': 'Turn on Hand tracking and show one hand to the camera.',
    'help.g2': 'Pinch your thumb and index finger to draw. Open the fingers to lift the pen.',
    'help.g3': 'Hold a fist for one second to clear the canvas.',
    'toast.cam_insecure': 'The camera needs HTTPS or localhost.',
    'toast.cam_denied': 'Camera access is blocked. Allow it in the browser and try again.',
    'toast.cam_none': 'No camera found.',
    'toast.cam_load': 'Could not load hand tracking. Check the connection and try again.',
    'toast.saved': 'Sample saved', 'toast.save_err': 'Could not save the sample',
    'toast.bad_label': 'Label does not match the selected symbols', 'toast.no_ink': 'Draw something first',
    'err.predict': 'Prediction failed. Check the server and try again.',
  },
  uk: {
    'app.title': 'Розпізнавання рукопису',
    'side.model': 'Модель', 'side.stroke': 'Товщина штриха', 'side.symbols': 'Символи', 'mode.letters': 'Літери', 'mode.digits': 'Цифри',
    'backend.server': 'Сервер', 'backend.browser': 'Браузер',
    'conn.unknown': 'Підключення', 'conn.on': 'Сервер доступний', 'conn.off': 'Сервер недоступний',
    'theme.toggle': 'Змінити тему',
    'kpi.inference': 'Інференс', 'kpi.median': 'Медіанна затримка', 'kpi.p95': 'Затримка P95', 'kpi.count': 'Розпізнавань',
    'unit.ms': 'мс',
    'canvas.title': 'Полотно', 'canvas.label': 'Мітка',
    'btn.undo': 'Скасувати', 'btn.clear': 'Очистити', 'btn.save': 'Зберегти зразок',
    'pred.title': 'Результат', 'pred.input': 'Вхід моделі', 'pred.empty': 'Намалюйте символ',
    'latency.title': 'Затримка', 'latency.sub': 'від pointermove до кадру', 'latency.empty': 'Ще немає вимірювань',
    'history.title': 'Історія', 'history.empty': 'Ще немає розпізнавань',
    'kind.letter': 'Літера', 'kind.digit': 'Цифра',
    'help.title': 'Як користуватись', 'help.keys': 'Гарячі клавіші',
    'help.s1': 'Намалюйте літеру або цифру. Результат оновлюється з кожним штрихом.',
    'help.s2': 'Перемикайте модель між сервером і браузером, щоб порівняти затримку.',
    'help.s3': 'Перевірте мітку й збережіть зразок, щоб зібрати власний датасет.',
    'side.input': 'Введення', 'input.camera': 'Жести руки', 'input.camera_sub': 'Камера · щипок для малювання',
    'cam.loading': 'Завантаження трекінгу', 'cam.nohand': 'Покажіть руку', 'cam.up': 'Перо піднято', 'cam.down': 'Малювання', 'cam.clearing': 'Очищення',
    'cam.hint': 'Стисніть пальці, щоб малювати. Тримайте кулак секунду, щоб очистити.',
    'help.gestures': 'Жести руки',
    'help.g1': 'Увімкніть «Жести руки» й покажіть одну руку камері.',
    'help.g2': 'Стисніть великий і вказівний пальці, щоб малювати. Розведіть пальці, щоб підняти перо.',
    'help.g3': 'Тримайте кулак одну секунду, щоб очистити полотно.',
    'toast.cam_insecure': 'Камері потрібен HTTPS або localhost.',
    'toast.cam_denied': 'Доступ до камери заблоковано. Дозвольте його в браузері й спробуйте ще раз.',
    'toast.cam_none': 'Камеру не знайдено.',
    'toast.cam_load': 'Не вдалося завантажити трекінг руки. Перевірте з\'єднання й спробуйте ще раз.',
    'toast.saved': 'Зразок збережено', 'toast.save_err': 'Не вдалося зберегти зразок',
    'toast.bad_label': 'Мітка не відповідає вибраним символам', 'toast.no_ink': 'Спочатку намалюйте символ',
    'err.predict': 'Не вдалося розпізнати. Перевірте сервер і спробуйте ще раз.',
  },
};

let lang = document.documentElement.lang in DICT ? document.documentElement.lang : 'en';
const listeners = [];

export const getLang = () => lang;
export const onLangChange = fn => listeners.push(fn);

export function t(key, vars) {
  let s = (DICT[lang] && DICT[lang][key]) ?? DICT.en[key] ?? key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.dataset.i18nAttr.split(';').forEach(pair => { const [attr, key] = pair.split(':'); if (attr && key) el.setAttribute(attr.trim(), t(key.trim())); });
  });
}

export function setLang(l) {
  if (!(l in DICT)) return;
  lang = l; document.documentElement.lang = l;
  try { localStorage.setItem('lang', l); } catch (e) {}
  applyI18n(); listeners.forEach(fn => fn(l));
}

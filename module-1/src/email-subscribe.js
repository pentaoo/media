/** Shared newsletter submission for the intro dialog and the landing form. */
export function mountEmailSubscribe(form, { signal } = {}) {
  const emailInput = form.querySelector('input[type="email"]');
  const submitButton = form.querySelector('[type="submit"]');
  const status = form.querySelector('[role="status"]');
  const options = signal ? { signal } : undefined;

  emailInput.addEventListener('input', () => {
    emailInput.removeAttribute('aria-invalid');
    status.textContent = '';
  }, options);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitButton.disabled) return;
    const email = emailInput.value.trim();
    emailInput.value = email;
    if (!emailInput.checkValidity()) {
      emailInput.setAttribute('aria-invalid', 'true');
      status.textContent = 'проверь адрес электропочты';
      emailInput.focus();
      return;
    }

    const endpoint = form.action;
    if (!/^https:\/\/formspree\.io\/f\/[a-z0-9]+\/?$/i.test(endpoint)) {
      status.textContent = 'форма пока не настроена, попробуй позже';
      return;
    }

    submitButton.disabled = true;
    status.textContent = 'отправляем…';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      if (response.status === 429) {
        status.textContent = 'слишком много попыток, попробуй позже';
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errors = Array.isArray(data?.errors) ? data.errors : [];
        if (errors.some((error) => error?.field === 'email')) {
          emailInput.setAttribute('aria-invalid', 'true');
        }
        status.textContent = errors.map((error) => error?.message).filter((message) => typeof message === 'string').join(' ') || 'не получилось отправить адрес, попробуй ещё раз';
        return;
      }
      form.reset();
      status.textContent = 'готово, ты в списке';
    } catch {
      status.textContent = 'не получилось отправить адрес, попробуй ещё раз';
    } finally {
      submitButton.disabled = false;
    }
  }, options);
}

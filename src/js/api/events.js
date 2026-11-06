// Источник данных о мероприятиях.
// Если в .env заданы VITE_AIRTABLE_BASE_ID и VITE_AIRTABLE_TOKEN — читаем Airtable API,
// иначе берём демо-данные из public/data/events.json (тот же формат ответа).

const { VITE_AIRTABLE_BASE_ID: baseId, VITE_AIRTABLE_TOKEN: token, VITE_AIRTABLE_TABLE: table = 'Events' } =
  import.meta.env;

const useAirtable = Boolean(baseId && token);

function normalize(record) {
  const f = record.fields ?? {};
  return {
    id: record.id,
    title: f['Название'] ?? 'без названия',
    date: f['Дата'] ? new Date(f['Дата']) : null,
    place: f['Место'] ?? '',
    tags: Array.isArray(f['Категория']) ? f['Категория'] : [],
    description: f['Описание'] ?? '',
  };
}

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Сервер ответил ${response.status}`);
  return response.json();
}

export async function getEvents() {
  const data = useAirtable
    ? await request(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?sort%5B0%5D%5Bfield%5D=%D0%94%D0%B0%D1%82%D0%B0`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    : await request(`${import.meta.env.BASE_URL}data/events.json`);
  return (data.records ?? []).map(normalize).sort((a, b) => (a.date ?? 0) - (b.date ?? 0));
}

export async function getEvent(id) {
  if (useAirtable) {
    const record = await request(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return normalize(record);
  }
  const events = await getEvents();
  return events.find((event) => event.id === id) ?? null;
}

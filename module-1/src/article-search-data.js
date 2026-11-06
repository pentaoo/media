// Editorial previews for the prototype. Unpublished stories open the existing whitelist page.
// tags come from the rubric dictionary; status: 'new' is set by hand and shows the burst.
// minutes and lead (a short lowercase prologue) show when the card is in focus in the phone search.
export const articleSearchItems = [
  { id: 'madk1d', status: 'new', tags: ['сниппеты', 'клипы'], artist: 'madk1d', title: 'За пределами припева', image: './assets/figma/article/madk1d-concert.png', position: '50% 58%', minutes: 6, lead: 'madk1d сомневался, нужен ли этот трек его аудитории. через несколько недель припев уже пели все, разбираемся почему.' },
  { id: 'kitay-night', tags: ['удалённое'], artist: 'Китай-город', title: 'Там уже началось', image: './assets/video/editorial/kitay-night-86bc7af48de9/poster.jpg', position: '50% 62%', minutes: 8, lead: 'ночь пятницы у выхода из метро: кто приходит первым, где собираются и почему здесь всегда немного громче.' },
  { id: 'new-scene', tags: ['фиты'], artist: 'Новая сцена', title: 'Свои люди. Свой звук', image: './assets/video/editorial/kitay-people-0dd1e134849b/poster.jpg', position: '50% 24%', minutes: 7, lead: 'молодые артисты зовут друг друга на фиты и вместе собирают залы. как устроена сцена, где все свои.' },
  { id: 'club-night', tags: ['биты'], artist: 'Клубная ночь', title: 'Диджей, который не смотрит в телефон', image: './assets/video/dj.jpg', position: '50% 44%', minutes: 5, lead: 'он не снимает толпу и не листает ленту за пультом. говорим о том, как держать зал без телефона.' },
  { id: 'smoke', tags: ['сохранёнки'], artist: 'Живой звук', title: 'Сквозь дым до первого ряда', image: './assets/video/editorial/concert-crowd-7026abb1ab1c/poster.jpg', position: '50% 78%', minutes: 9, lead: 'дым, свет и давка у сцены. проходим концерт от входа до первого ряда и записываем, что слышно по пути.' },
  { id: 'red-square', tags: ['пропавшие'], artist: 'Город', title: 'Флешмоб, который никто не планировал', image: './assets/video/moscow.jpg', position: '50% 50%', minutes: 6, lead: 'видео разлетелось за вечер, но никто не помнит, кто начал. собираем историю по чужим сторис.' },
  { id: 'stadium', tags: ['клипы'], artist: 'Большой концерт', title: 'Что слышно с последнего ряда', image: './assets/video/concert.jpg', position: '50% 55%', minutes: 10, lead: 'сидим на самом верху и слушаем, как звук доходит до последнего ряда, с опозданием и эхом.' },
  { id: 'after-party', tags: ['бифы'], artist: 'После концерта', title: 'Куда идти, когда закрылся зал', image: './assets/video/editorial/kitay-street-c41b36032219/poster.jpg', position: '50% 50%', minutes: 7, lead: 'зал закрылся, расходиться никто не хочет. маршрут по местам, где ночь продолжается.' },
  { id: 'first-track', tags: ['дропы'], artist: 'Первый трек', title: 'С чего всё начинается', image: './assets/video/editorial/madk1d-chorus-6e39d25cf629/poster.jpg', position: '50% 16%', minutes: 11, lead: 'первый трек записан на телефон в комнате общаги. вспоминаем, с чего начинали артисты, которых теперь слушают все.' },
];

export function searchArticles(query = '') {
  const words = query.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
  return articleSearchItems.filter(item => words.every(word => `${item.artist} ${item.title}`.toLocaleLowerCase('ru').replace(/ё/g, 'е').includes(word)));
}

// The empty search is a feed preview: repeat the materials so reviewers can scroll a longer list.
export function searchFeed(query = '', length = 28) {
  const matches = searchArticles(query);
  if (query.trim() || !matches.length) return matches;
  return Array.from({ length: Math.max(length, matches.length) }, (_, index) => {
    const item = matches[index % matches.length];
    return index < matches.length ? item : { ...item, status: undefined };
  });
}

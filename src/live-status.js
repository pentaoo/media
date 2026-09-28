// Точка подключения будущего внешнего источника. Возвращайте статусы ТОЛЬКО
// для переданных редакцией login: { login: 'live' | 'offline' }.
// Сейчас достоверного источника нет, поэтому состояние всех каналов неизвестно.
export async function getApprovedChannelStatuses(_channels) {
  return {};
}

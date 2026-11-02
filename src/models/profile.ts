export function greetingText(nickname: string, customGreeting = '', now = new Date()): string {
  const hour = now.getHours();
  const automatic = hour < 5 ? '夜深了' : hour < 9 ? '早上好' : hour < 12 ? '上午好'
    : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  const greeting = customGreeting.trim() || automatic;
  return nickname.trim() ? greeting + '，' + nickname.trim() : greeting;
}

export function avatarText(nickname: string): string {
  return Array.from(nickname.trim())[0] || '';
}

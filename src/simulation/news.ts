import type { GameState, NewsCategory, NewsItem } from '@/types';
import { nextId } from './commands';

const MAX_NEWS = 300;

export function addNews(
  state: GameState,
  category: NewsCategory,
  tone: NewsItem['tone'],
  title: string,
  body?: string,
): void {
  // Copy-on-Write: die Nachrichtenliste wird zwischen Snapshots geteilt.
  const item = { id: nextId(state, 'news'), day: state.time.day, category, tone, title, body };
  state.news = [item, ...state.news.slice(0, MAX_NEWS - 1)];
}

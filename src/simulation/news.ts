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
  state.news.unshift({ id: nextId(state, 'news'), day: state.time.day, category, tone, title, body });
  if (state.news.length > MAX_NEWS) state.news.length = MAX_NEWS;
}

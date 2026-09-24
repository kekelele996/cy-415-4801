import { EXCHANGE_ACTION_FLOW, EXCHANGE_ITEM_LIMIT, ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import type { Exchange, ExchangeDraft } from '@/models/exchange';

import { itemApi } from './itemApi';
import { storage, STORAGE_KEYS } from '@/utils/storage';

const seedExchanges: Exchange[] = [
  {
    id: 'exchange_seed',
    from_user_id: 'user_me',
    to_user_id: 'user_lin',
    from_item_ids: ['item_chair'],
    to_item_id: 'item_camera',
    status: ExchangeStatus.PENDING,
    from_confirmed: false,
    to_confirmed: false,
    message: '露营椅换拍立得，可以同城当面交换。',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

type LegacyExchange = Partial<Exchange> & { from_item_id?: string };

const normalizeExchange = (raw: LegacyExchange): Exchange => ({
  ...(raw as Exchange),
  from_item_ids: Array.isArray(raw.from_item_ids)
    ? raw.from_item_ids
    : [raw.from_item_id].filter((id): id is string => Boolean(id)),
  from_confirmed: Boolean(raw.from_confirmed),
  to_confirmed: Boolean(raw.to_confirmed),
});

export const exchangeApi = {
  async list(): Promise<Exchange[]> {
    const exchanges = await storage.get<LegacyExchange[]>(STORAGE_KEYS.exchanges, []);
    if (exchanges.length) {
      const normalized = exchanges.map(normalizeExchange);
      await storage.set(STORAGE_KEYS.exchanges, normalized);
      return normalized;
    }
    await storage.set(STORAGE_KEYS.exchanges, seedExchanges);
    return seedExchanges;
  },

  async create(draft: ExchangeDraft): Promise<Exchange> {
    const exchanges = await this.list();
    if (!draft.from_item_ids.length || draft.from_item_ids.length > EXCHANGE_ITEM_LIMIT) {
      throw new Error(`一笔交换需要勾选 1-${EXCHANGE_ITEM_LIMIT} 件自己的物品`);
    }
    const targetItem = await itemApi.detail(draft.to_item_id);
    if (!targetItem || targetItem.status !== ItemStatus.AVAILABLE) {
      throw new Error('目标物品当前不可交换');
    }
    const nextExchange: Exchange = {
      ...draft,
      id: storage.createId('exchange'),
      status: draft.status ?? ExchangeStatus.PENDING,
      from_confirmed: draft.from_confirmed ?? false,
      to_confirmed: draft.to_confirmed ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await itemApi.setStatus(draft.to_item_id, ItemStatus.RESERVED);
    await storage.set(STORAGE_KEYS.exchanges, [nextExchange, ...exchanges]);
    return nextExchange;
  },

  async transition(id: string, status: ExchangeStatus): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (!EXCHANGE_ACTION_FLOW[current.status].includes(status)) {
      throw new Error('当前状态不允许该操作');
    }
    const nextExchange: Exchange = { ...current, status, updated_at: new Date().toISOString() };
    if (status === ExchangeStatus.REJECTED || status === ExchangeStatus.CANCELLED) {
      await itemApi.setStatus(current.to_item_id, ItemStatus.AVAILABLE);
    }
    if (status === ExchangeStatus.COMPLETED) {
      await this.markExchanged(current);
    }
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    return nextExchange;
  },

  async confirm(id: string, userId: string): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (current.status !== ExchangeStatus.ACCEPTED) {
      throw new Error('当前状态不允许确认交货');
    }
    if (userId !== current.from_user_id && userId !== current.to_user_id) {
      throw new Error('只有交换双方可以确认交货');
    }
    const nextExchange: Exchange = { ...current, updated_at: new Date().toISOString() };
    if (userId === current.from_user_id) {
      if (current.from_confirmed) throw new Error('你已确认过交货');
      nextExchange.from_confirmed = true;
    } else {
      if (current.to_confirmed) throw new Error('你已确认过交货');
      nextExchange.to_confirmed = true;
    }
    if (nextExchange.from_confirmed && nextExchange.to_confirmed) {
      nextExchange.status = ExchangeStatus.COMPLETED;
      await this.markExchanged(current);
    }
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    return nextExchange;
  },

  async markExchanged(exchange: Exchange): Promise<void> {
    await Promise.all(
      [...exchange.from_item_ids, exchange.to_item_id].map((itemId) =>
        itemApi.setStatus(itemId, ItemStatus.EXCHANGED),
      ),
    );
  },
};

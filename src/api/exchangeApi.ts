import { EXCHANGE_ACTION_FLOW, ExchangeStatus, MAX_OFFER_ITEMS } from '@/constants/exchange';
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
    message: '露营椅换拍立得，可以同城当面交换。',
    from_confirmed: false,
    to_confirmed: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

type LegacyExchange = Partial<Exchange> & { from_item_id?: string };

/** 兼容旧数据：单件 from_item_id 升级为数组，补齐双方确认标记 */
const normalizeExchange = (raw: LegacyExchange): Exchange => {
  const fromItemIds = Array.isArray(raw.from_item_ids)
    ? raw.from_item_ids
    : raw.from_item_id
      ? [raw.from_item_id]
      : [];
  return {
    ...(raw as Exchange),
    from_item_ids: fromItemIds,
    from_confirmed: Boolean(raw.from_confirmed),
    to_confirmed: Boolean(raw.to_confirmed),
  };
};

const involvedItemIds = (exchange: Exchange) => [...exchange.from_item_ids, exchange.to_item_id];

/** 释放保留：仅把仍处于保留中的相关物品退回可交换 */
const releaseReservedItems = async (exchange: Exchange) => {
  for (const itemId of involvedItemIds(exchange)) {
    const item = await itemApi.detail(itemId);
    if (item?.status === ItemStatus.RESERVED) {
      await itemApi.setStatus(itemId, ItemStatus.AVAILABLE);
    }
  }
};

export const exchangeApi = {
  async list(): Promise<Exchange[]> {
    const exchanges = await storage.get<LegacyExchange[]>(STORAGE_KEYS.exchanges, []);
    if (exchanges.length) return exchanges.map(normalizeExchange);
    await storage.set(STORAGE_KEYS.exchanges, seedExchanges);
    return seedExchanges;
  },

  async create(draft: ExchangeDraft): Promise<Exchange> {
    const exchanges = await this.list();
    const offerIds = [...new Set(draft.from_item_ids)];
    if (!offerIds.length || offerIds.length > MAX_OFFER_ITEMS) {
      throw new Error(`一次交换请勾选 1-${MAX_OFFER_ITEMS} 件自己的物品`);
    }
    for (const offerId of offerIds) {
      const offerItem = await itemApi.detail(offerId);
      if (!offerItem || offerItem.user_id !== draft.from_user_id || offerItem.status !== ItemStatus.AVAILABLE) {
        throw new Error('勾选物品当前不可用于交换');
      }
    }
    const targetItem = await itemApi.detail(draft.to_item_id);
    if (!targetItem || targetItem.status !== ItemStatus.AVAILABLE) {
      throw new Error('目标物品当前不可交换');
    }
    const nextExchange: Exchange = {
      ...draft,
      from_item_ids: offerIds,
      id: storage.createId('exchange'),
      status: draft.status ?? ExchangeStatus.PENDING,
      from_confirmed: false,
      to_confirmed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // 占用保留：对方物品卡与发起方拿出的物品，在交换结束前别人不能再发起
    for (const itemId of involvedItemIds(nextExchange)) {
      await itemApi.setStatus(itemId, ItemStatus.RESERVED);
    }
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
      await releaseReservedItems(current);
    }
    if (status === ExchangeStatus.COMPLETED) {
      for (const itemId of involvedItemIds(current)) {
        await itemApi.setStatus(itemId, ItemStatus.EXCHANGED);
      }
    }
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    return nextExchange;
  },

  /** 一方确认交货；双方都确认后才流转为已完成 */
  async confirmDelivery(id: string, userId: string): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (current.status !== ExchangeStatus.ACCEPTED) {
      throw new Error('当前状态不允许确认交货');
    }
    if (userId !== current.from_user_id && userId !== current.to_user_id) {
      throw new Error('只有交换双方可以确认交货');
    }
    const nextExchange: Exchange = {
      ...current,
      from_confirmed: current.from_confirmed || userId === current.from_user_id,
      to_confirmed: current.to_confirmed || userId === current.to_user_id,
      updated_at: new Date().toISOString(),
    };
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    if (nextExchange.from_confirmed && nextExchange.to_confirmed) {
      return this.transition(id, ExchangeStatus.COMPLETED);
    }
    return nextExchange;
  },
};

import { defineStore } from 'pinia';

import { exchangeApi } from '@/api/exchangeApi';
import { itemApi } from '@/api/itemApi';
import { ExchangeStatus } from '@/constants/exchange';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import { useItemStore } from '@/stores/itemStore';
import { message } from '@/utils/message';

export const useExchangeStore = defineStore('exchanges', {
  state: () => ({
    exchanges: [] as Exchange[],
    statusFilter: 'all' as ExchangeStatus | 'all',
    loading: false,
  }),
  getters: {
    sent: (state) => (userId: string) => state.exchanges.filter((item) => item.from_user_id === userId),
    received: (state) => (userId: string) => state.exchanges.filter((item) => item.to_user_id === userId),
    filtered: (state) => {
      if (state.statusFilter === 'all') return state.exchanges;
      return state.exchanges.filter((item) => item.status === state.statusFilter);
    },
  },
  actions: {
    async hydrate() {
      this.loading = true;
      try {
        this.exchanges = await exchangeApi.list();
      } finally {
        this.loading = false;
      }
    },
    async refresh() {
      this.exchanges = await exchangeApi.list();
      // 物品保留/释放/成交都发生在交换流转里，物品列表必须同步刷新
      const itemStore = useItemStore();
      itemStore.items = await itemApi.list();
    },
    async create(draft: ExchangeDraft) {
      const exchange = await exchangeApi.create({ ...draft, status: ExchangeStatus.PENDING });
      await this.refresh();
      message('交换请求已发出，相关物品已为你保留', 'success');
      return exchange;
    },
    async accept(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.ACCEPTED);
      await this.refresh();
      message('已同意交换，等待双方确认交货', 'success');
    },
    async reject(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.REJECTED);
      await this.refresh();
      message('已拒绝交换，物品保留已释放', 'success');
    },
    async cancel(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.CANCELLED);
      await this.refresh();
      message('已取消交换，物品保留已释放', 'success');
    },
    async confirmDelivery(id: string, userId: string) {
      const exchange = await exchangeApi.confirmDelivery(id, userId);
      await this.refresh();
      if (exchange.status === ExchangeStatus.COMPLETED) {
        message('双方已确认交货，交换完成', 'success');
      } else {
        message('已确认交货，等待对方确认', 'success');
      }
    },
  },
});

import { defineStore } from 'pinia';

import { exchangeApi } from '@/api/exchangeApi';
import { ExchangeStatus } from '@/constants/exchange';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
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
    async create(draft: ExchangeDraft) {
      const exchange = await exchangeApi.create({ ...draft, status: ExchangeStatus.PENDING });
      this.exchanges = await exchangeApi.list();
      message('交换请求已发出', 'success');
      return exchange;
    },
    async accept(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.ACCEPTED);
      this.exchanges = await exchangeApi.list();
      message('已同意交换', 'success');
    },
    async reject(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.REJECTED);
      this.exchanges = await exchangeApi.list();
      message('已拒绝交换，物品已释放', 'success');
    },
    async cancel(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.CANCELLED);
      this.exchanges = await exchangeApi.list();
      message('交换已取消，物品已释放', 'success');
    },
    async confirm(id: string, userId: string) {
      const exchange = await exchangeApi.confirm(id, userId);
      this.exchanges = await exchangeApi.list();
      message(
        exchange.status === ExchangeStatus.COMPLETED ? '双方已确认交货，交换完成' : '已确认交货，等待对方确认',
        'success',
      );
    },
  },
});

<template>
  <article class="exchange-card">
    <header>
      <span class="status-pill" :class="statusToneClass(exchange.status)">
        {{ formatExchangeStatus(exchange.status) }}
      </span>
      <small>{{ formatDate(exchange.updated_at) }}</small>
    </header>
    <div class="exchange-card__items">
      <div>
        <span>拿出</span>
        <strong v-for="(item, index) in fromItems" :key="item.id ?? index">{{ item.title }}</strong>
      </div>
      <div>
        <span>换取</span>
        <strong>{{ toItem?.title ?? '未知物品' }}</strong>
      </div>
    </div>
    <p class="exchange-card__progress">{{ progressText }}</p>
    <div v-if="exchange.status === ExchangeStatus.ACCEPTED" class="exchange-card__confirm">
      <span :class="{ done: exchange.from_confirmed }">
        {{ fromUser?.nickname ?? '发起方' }}{{ exchange.from_confirmed ? '已确认交货' : '未确认' }}
      </span>
      <span :class="{ done: exchange.to_confirmed }">
        {{ toUser?.nickname ?? '接收方' }}{{ exchange.to_confirmed ? '已确认交货' : '未确认' }}
      </span>
    </div>
    <p v-if="exchange.message" class="exchange-card__message">留言：{{ exchange.message }}</p>
    <footer>
      <span v-if="fromUser && toUser">{{ fromUser.nickname }} → {{ toUser.nickname }}</span>
      <div class="exchange-card__actions">
        <button v-if="isReceiver && exchange.status === ExchangeStatus.PENDING" type="button" @click="$emit('accept', exchange.id)">
          同意
        </button>
        <button v-if="isReceiver && exchange.status === ExchangeStatus.PENDING" type="button" @click="$emit('reject', exchange.id)">
          拒绝
        </button>
        <button v-if="isParty && exchange.status === ExchangeStatus.ACCEPTED && !myConfirmed" type="button" @click="$emit('confirm', exchange.id)">
          确认交货
        </button>
        <button v-if="canCancel" type="button" @click="$emit('cancel', exchange.id)">
          取消交换
        </button>
      </div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ExchangeStatus } from '@/constants/exchange';
import type { Exchange } from '@/models/exchange';
import type { Item } from '@/models/item';
import type { User } from '@/models/user';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, formatExchangeProgress, formatExchangeStatus, statusToneClass } from '@/utils/formatters';

const props = defineProps<{
  exchange: Exchange;
  items: Item[];
  users: User[];
}>();

defineEmits<{
  accept: [id: string];
  reject: [id: string];
  cancel: [id: string];
  confirm: [id: string];
}>();

const authStore = useAuthStore();
const fromItems = computed(() => {
  const titles = props.exchange.from_item_ids
    .map((id) => props.items.find((item) => item.id === id))
    .filter((item): item is Item => Boolean(item));
  return titles.length ? titles : [{ title: '未知物品' } as Item];
});
const toItem = computed(() => props.items.find((item) => item.id === props.exchange.to_item_id));
const fromUser = computed(() => props.users.find((user) => user.id === props.exchange.from_user_id));
const toUser = computed(() => props.users.find((user) => user.id === props.exchange.to_user_id));

const isFrom = computed(() => authStore.currentUser?.id === props.exchange.from_user_id);
const isReceiver = computed(() => authStore.currentUser?.id === props.exchange.to_user_id);
const isParty = computed(() => isFrom.value || isReceiver.value);
const myConfirmed = computed(() =>
  isFrom.value ? props.exchange.from_confirmed : isReceiver.value ? props.exchange.to_confirmed : false,
);
const canCancel = computed(
  () =>
    (isFrom.value && props.exchange.status === ExchangeStatus.PENDING) ||
    (isParty.value && props.exchange.status === ExchangeStatus.ACCEPTED),
);

const progressText = computed(() =>
  formatExchangeProgress(
    props.exchange,
    authStore.currentUser?.id,
    fromUser.value?.nickname ?? '发起方',
    toUser.value?.nickname ?? '接收方',
  ),
);
</script>

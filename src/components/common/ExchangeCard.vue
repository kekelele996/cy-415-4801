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
        <span>拿出 {{ fromItems.length > 1 ? `${fromItems.length} 件` : '' }}</span>
        <strong v-for="fromItem in fromItems" :key="fromItem.id">{{ fromItem.title }}</strong>
        <strong v-if="!fromItems.length">未知物品</strong>
      </div>
      <div>
        <span>换取</span>
        <strong>{{ toItem?.title ?? '未知物品' }}</strong>
      </div>
    </div>
    <p class="exchange-card__waiting">{{ waitingText }}</p>
    <p v-if="exchange.message" class="exchange-card__message">{{ exchange.message }}</p>
    <footer>
      <span v-if="fromUser && toUser">{{ fromUser.nickname }} → {{ toUser.nickname }}</span>
      <div v-if="hasActions" class="exchange-card__actions">
        <button v-if="canAccept" type="button" @click="$emit('accept', exchange.id)">同意</button>
        <button v-if="canReject" type="button" @click="$emit('reject', exchange.id)">拒绝</button>
        <button v-if="canCancel" type="button" @click="$emit('cancel', exchange.id)">取消</button>
        <button v-if="canConfirm" type="button" @click="$emit('confirm', exchange.id)">确认交货</button>
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
import {
  formatDate,
  formatExchangeStatus,
  formatExchangeWaiting,
  statusToneClass,
} from '@/utils/formatters';

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
const fromItems = computed(() =>
  props.exchange.from_item_ids
    .map((itemId) => props.items.find((item) => item.id === itemId))
    .filter((item): item is Item => Boolean(item)),
);
const toItem = computed(() => props.items.find((item) => item.id === props.exchange.to_item_id));
const fromUser = computed(() => props.users.find((user) => user.id === props.exchange.from_user_id));
const toUser = computed(() => props.users.find((user) => user.id === props.exchange.to_user_id));

const viewerId = computed(() => authStore.currentUser?.id);
const isReceiver = computed(() => viewerId.value === props.exchange.to_user_id);
const isInitiator = computed(() => viewerId.value === props.exchange.from_user_id);
const myConfirmed = computed(() =>
  isInitiator.value ? props.exchange.from_confirmed : isReceiver.value ? props.exchange.to_confirmed : true,
);

const waitingText = computed(() => formatExchangeWaiting(props.exchange, viewerId.value, props.users));

const canAccept = computed(() => isReceiver.value && props.exchange.status === ExchangeStatus.PENDING);
const canReject = computed(() => isReceiver.value && props.exchange.status === ExchangeStatus.PENDING);
const canCancel = computed(() => isInitiator.value && props.exchange.status === ExchangeStatus.PENDING);
const canConfirm = computed(
  () =>
    (isInitiator.value || isReceiver.value) &&
    props.exchange.status === ExchangeStatus.ACCEPTED &&
    !myConfirmed.value,
);
const hasActions = computed(
  () => canAccept.value || canReject.value || canCancel.value || canConfirm.value,
);
</script>

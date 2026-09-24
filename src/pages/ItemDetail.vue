<template>
  <section v-if="item" class="page detail-page">
    <RouterLink class="text-link" to="/home">返回首页</RouterLink>
    <div class="detail-layout">
      <ItemImageGallery :images="item.images" :fallback-text="item.category" />
      <article class="detail-panel">
        <div class="item-card__topline">
          <span class="pill">{{ item.category }}</span>
          <span class="status-pill" :class="statusToneClass(item.status)">
            {{ formatItemStatus(item.status) }}
          </span>
        </div>
        <h1>{{ item.title }}</h1>
        <p>{{ item.description }}</p>
        <dl class="detail-list">
          <div>
            <dt>成色</dt>
            <dd>{{ formatCondition(item.condition) }}</dd>
          </div>
          <div>
            <dt>地点</dt>
            <dd>{{ item.location }}</dd>
          </div>
          <div>
            <dt>发布时间</dt>
            <dd>{{ formatDate(item.created_at) }}</dd>
          </div>
        </dl>
        <UserBrief v-if="owner" :user="owner" />

        <div v-if="!isMine" class="exchange-box">
          <div class="exchange-picker">
            <span>我的交换物（勾选 1-{{ EXCHANGE_ITEM_LIMIT }} 件）</span>
            <div class="exchange-picker__list">
              <label
                v-for="myItem in ownAvailableItems"
                :key="myItem.id"
                class="exchange-picker__option"
                :class="{ 'exchange-picker__option--disabled': isOptionDisabled(myItem.id) }"
              >
                <input
                  v-model="selectedItemIds"
                  type="checkbox"
                  :value="myItem.id"
                  :disabled="isOptionDisabled(myItem.id)"
                />
                <span>{{ myItem.title }}</span>
              </label>
            </div>
            <small v-if="!ownAvailableItems.length" class="form-note">{{ FORM_MESSAGES.exchangeNeedOwnItem }}</small>
          </div>
          <label>
            留言
            <textarea v-model="messageText" rows="3" />
          </label>
          <button class="primary-button" type="button" :disabled="item.status !== ItemStatus.AVAILABLE" @click="requestExchange">
            {{ exchangeButtonText }}
          </button>
        </div>
        <button v-else-if="item.status === ItemStatus.AVAILABLE" class="secondary-button" type="button" @click="offlineItem">
          下架这件物品
        </button>
      </article>
    </div>
  </section>
  <EmptyState v-else title="物品不存在" description="可能已被清理或链接无效" mark="404" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import EmptyState from '@/components/common/EmptyState.vue';
import ItemImageGallery from '@/components/common/ItemImageGallery.vue';
import UserBrief from '@/components/common/UserBrief.vue';
import { EXCHANGE_ITEM_LIMIT, ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { FORM_MESSAGES } from '@/constants/messages';
import { useAuthStore } from '@/stores/authStore';
import { useExchangeStore } from '@/stores/exchangeStore';
import { useItemStore } from '@/stores/itemStore';
import { formatCondition, formatDate, formatItemStatus, statusToneClass } from '@/utils/formatters';
import { message } from '@/utils/message';

const route = useRoute();
const itemStore = useItemStore();
const authStore = useAuthStore();
const exchangeStore = useExchangeStore();

const item = computed(() => itemStore.items.find((entry) => entry.id === route.params.id));
const owner = computed(() => authStore.users.find((user) => user.id === item.value?.user_id));
const isMine = computed(() => authStore.currentUser?.id === item.value?.user_id);
const ownAvailableItems = computed(() =>
  authStore.currentUser ? itemStore.availableMyItems(authStore.currentUser.id) : [],
);
const selectedItemIds = ref<string[]>([]);
const messageText = ref('我想用这几件闲置与你交换，可以沟通时间和地点。');

const isOptionDisabled = (itemId: string) =>
  !selectedItemIds.value.includes(itemId) && selectedItemIds.value.length >= EXCHANGE_ITEM_LIMIT;

const exchangeButtonText = computed(() => {
  if (!item.value || item.value.status === ItemStatus.AVAILABLE) return '发起交换';
  return `${formatItemStatus(item.value.status)}，暂不可发起`;
});

const requestExchange = async () => {
  if (!authStore.currentUser || !item.value || !owner.value) return;
  if (!itemStore.assertCanExchange(authStore.currentUser.id)) return;
  if (!selectedItemIds.value.length) {
    message(FORM_MESSAGES.exchangeNeedSelect, 'error');
    return;
  }
  if (selectedItemIds.value.length > EXCHANGE_ITEM_LIMIT) {
    message(FORM_MESSAGES.exchangeItemLimit, 'error');
    return;
  }
  await exchangeStore.create({
    from_user_id: authStore.currentUser.id,
    to_user_id: owner.value.id,
    from_item_ids: [...selectedItemIds.value],
    to_item_id: item.value.id,
    status: ExchangeStatus.PENDING,
    message: messageText.value,
  });
  selectedItemIds.value = [];
  await itemStore.hydrate();
};

const offlineItem = async () => {
  if (!item.value) return;
  await itemStore.offline(item.value.id);
};
</script>

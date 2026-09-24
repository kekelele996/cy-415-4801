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
          <div class="offer-picker">
            <span class="offer-picker__label">
              我的交换物（已选 {{ selectedItemIds.length }}/{{ MAX_OFFER_ITEMS }}）
            </span>
            <label
              v-for="myItem in ownAvailableItems"
              :key="myItem.id"
              class="offer-picker__option"
              :class="{ checked: selectedItemIds.includes(myItem.id) }"
            >
              <input
                type="checkbox"
                :value="myItem.id"
                :checked="selectedItemIds.includes(myItem.id)"
                :disabled="!selectedItemIds.includes(myItem.id) && selectedItemIds.length >= MAX_OFFER_ITEMS"
                @change="toggleOffer(myItem.id)"
              />
              {{ myItem.title }}
            </label>
            <p v-if="!ownAvailableItems.length" class="form-note">{{ FORM_MESSAGES.exchangeNeedOwnItem }}</p>
          </div>
          <label>
            留言
            <textarea v-model="messageText" rows="3" />
          </label>
          <p v-if="item.status === ItemStatus.RESERVED" class="form-note">
            {{ STATUS_MESSAGE_MAP[ItemStatus.RESERVED] }}，暂不能发起新交换
          </p>
          <button class="primary-button" type="button" :disabled="item.status !== ItemStatus.AVAILABLE" @click="requestExchange">
            发起交换
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
import { ExchangeStatus, MAX_OFFER_ITEMS } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { FORM_MESSAGES, STATUS_MESSAGE_MAP } from '@/constants/messages';
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
const messageText = ref('我想用这些闲置与你交换，可以沟通时间和地点。');

const toggleOffer = (itemId: string) => {
  if (selectedItemIds.value.includes(itemId)) {
    selectedItemIds.value = selectedItemIds.value.filter((id) => id !== itemId);
    return;
  }
  if (selectedItemIds.value.length >= MAX_OFFER_ITEMS) {
    message(`一次最多勾选 ${MAX_OFFER_ITEMS} 件`, 'error');
    return;
  }
  selectedItemIds.value = [...selectedItemIds.value, itemId];
};

const requestExchange = async () => {
  if (!authStore.currentUser || !item.value || !owner.value) return;
  if (!itemStore.assertCanExchange(authStore.currentUser.id)) return;
  if (!selectedItemIds.value.length || selectedItemIds.value.length > MAX_OFFER_ITEMS) {
    message(FORM_MESSAGES.exchangeOfferRange, 'error');
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
};

const offlineItem = async () => {
  if (!item.value) return;
  await itemStore.offline(item.value.id);
};
</script>

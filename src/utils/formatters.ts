import dayjs from 'dayjs';

import { ExchangeStatus } from '@/constants/exchange';
import { ItemCondition, ItemStatus } from '@/constants/item';
import { STATUS_MESSAGE_MAP } from '@/constants/messages';
import type { Exchange } from '@/models/exchange';
import type { User } from '@/models/user';

export const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm');

export const formatItemStatus = (status: ItemStatus) => {
  const map: Record<ItemStatus, string> = {
    [ItemStatus.AVAILABLE]: '可交换',
    [ItemStatus.RESERVED]: '保留中',
    [ItemStatus.EXCHANGED]: '已交换',
    [ItemStatus.OFFLINE]: '已下架',
  };
  return map[status];
};

export const formatExchangeStatus = (status: ExchangeStatus) => {
  const map: Record<ExchangeStatus, string> = {
    [ExchangeStatus.PENDING]: '待确认',
    [ExchangeStatus.ACCEPTED]: '已同意',
    [ExchangeStatus.REJECTED]: '已拒绝',
    [ExchangeStatus.CANCELLED]: '已取消',
    [ExchangeStatus.COMPLETED]: '已完成',
  };
  return map[status];
};

export const formatCondition = (condition: ItemCondition) => {
  const map: Record<ItemCondition, string> = {
    [ItemCondition.NEW]: '全新',
    [ItemCondition.LIKE_NEW]: '九成新',
    [ItemCondition.GOOD]: '八成新',
    [ItemCondition.WORN]: '战损',
  };
  return map[condition];
};

export const formatCreditLevel = (score: number) => {
  if (score >= 90) return '守约达人';
  if (score >= 75) return '稳定交换';
  if (score >= 60) return '新晋用户';
  return '需谨慎';
};

export const statusToneClass = (status: ItemStatus | ExchangeStatus) => {
  if (status === ItemStatus.AVAILABLE || status === ExchangeStatus.ACCEPTED) return 'status-good';
  if (
    status === ItemStatus.OFFLINE ||
    status === ExchangeStatus.REJECTED ||
    status === ExchangeStatus.CANCELLED
  ) {
    return 'status-muted';
  }
  if (status === ItemStatus.EXCHANGED || status === ExchangeStatus.COMPLETED) return 'status-done';
  return 'status-wait';
};

export const formatStatusMessage = (status: ItemStatus | ExchangeStatus) => STATUS_MESSAGE_MAP[status];

/** 交换卡上的进展提示：明确写出正在等谁确认，不用翻留言猜 */
export const formatExchangeWaiting = (exchange: Exchange, viewerId: string | undefined, users: User[]) => {
  const fromName = users.find((user) => user.id === exchange.from_user_id)?.nickname ?? '发起方';
  const toName = users.find((user) => user.id === exchange.to_user_id)?.nickname ?? '对方';
  const isFrom = viewerId === exchange.from_user_id;
  const isTo = viewerId === exchange.to_user_id;
  switch (exchange.status) {
    case ExchangeStatus.PENDING:
      if (isTo) return '等待你处理：同意或拒绝';
      if (isFrom) return `等待 ${toName} 同意`;
      return `等待 ${toName} 处理`;
    case ExchangeStatus.ACCEPTED: {
      const waitFrom = !exchange.from_confirmed;
      const waitTo = !exchange.to_confirmed;
      if (waitFrom && waitTo) return '等待双方确认交货';
      if (waitFrom) return isFrom ? '等待你确认交货' : `等待 ${fromName} 确认交货`;
      if (waitTo) return isTo ? '等待你确认交货' : `等待 ${toName} 确认交货`;
      return '双方已确认交货';
    }
    case ExchangeStatus.REJECTED:
      return '已被拒绝，物品保留已释放';
    case ExchangeStatus.CANCELLED:
      return '已取消，物品保留已释放';
    case ExchangeStatus.COMPLETED:
      return '双方已确认交货，交换完成';
    default:
      return '';
  }
};

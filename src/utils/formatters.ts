import dayjs from 'dayjs';

import { ExchangeStatus } from '@/constants/exchange';
import { ItemCondition, ItemStatus } from '@/constants/item';
import { STATUS_MESSAGE_MAP } from '@/constants/messages';
import type { Exchange } from '@/models/exchange';

export const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm');

export const formatItemStatus = (status: ItemStatus) => {
  const map: Record<ItemStatus, string> = {
    [ItemStatus.AVAILABLE]: '可交换',
    [ItemStatus.RESERVED]: '交换中',
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
  if (status === ItemStatus.OFFLINE || status === ExchangeStatus.REJECTED || status === ExchangeStatus.CANCELLED)
    return 'status-muted';
  if (status === ItemStatus.EXCHANGED || status === ExchangeStatus.COMPLETED) return 'status-done';
  return 'status-wait';
};

export const formatStatusMessage = (status: ItemStatus | ExchangeStatus) => STATUS_MESSAGE_MAP[status];

export const formatExchangeProgress = (
  exchange: Exchange,
  viewerId: string | undefined,
  fromName: string,
  toName: string,
) => {
  const isViewerFrom = viewerId === exchange.from_user_id;
  const isViewerTo = viewerId === exchange.to_user_id;
  switch (exchange.status) {
    case ExchangeStatus.PENDING:
      return isViewerTo ? '等待你处理这笔交换' : `等待 ${toName} 处理这笔交换`;
    case ExchangeStatus.ACCEPTED: {
      if (!exchange.from_confirmed && !exchange.to_confirmed) return '已同意，等待双方确认交货';
      const viewerConfirmed =
        (isViewerFrom && exchange.from_confirmed) || (isViewerTo && exchange.to_confirmed);
      if (viewerConfirmed) {
        return `等待 ${isViewerFrom ? toName : fromName} 确认交货`;
      }
      if (isViewerFrom || isViewerTo) return '对方已确认，等待你确认交货';
      return '等待双方确认交货';
    }
    case ExchangeStatus.REJECTED:
      return '交换已拒绝，物品已释放';
    case ExchangeStatus.CANCELLED:
      return '交换已取消，物品已释放';
    case ExchangeStatus.COMPLETED:
      return '双方已确认交货，交换完成';
    default:
      return '';
  }
};

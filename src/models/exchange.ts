import { ExchangeStatus } from '@/constants/exchange';

export interface Exchange {
  id: string;
  from_user_id: string;
  to_user_id: string;
  /** 发起方拿出的物品，1-3 件 */
  from_item_ids: string[];
  to_item_id: string;
  status: ExchangeStatus;
  message: string;
  /** 发起方已确认交货 */
  from_confirmed: boolean;
  /** 接收方已确认交货 */
  to_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export type ExchangeDraft = Omit<
  Exchange,
  'id' | 'status' | 'from_confirmed' | 'to_confirmed' | 'created_at' | 'updated_at'
> & {
  status?: ExchangeStatus;
};

import { ExchangeStatus } from '@/constants/exchange';

export interface Exchange {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_item_ids: string[];
  to_item_id: string;
  status: ExchangeStatus;
  from_confirmed: boolean;
  to_confirmed: boolean;
  message: string;
  created_at: string;
  updated_at: string;
}

export type ExchangeDraft = Omit<
  Exchange,
  'id' | 'status' | 'from_confirmed' | 'to_confirmed' | 'created_at' | 'updated_at'
> & {
  status?: ExchangeStatus;
  from_confirmed?: boolean;
  to_confirmed?: boolean;
};

import type { SpaceId, DomainId } from './spaces';
import type { UnitChatProfileModel } from '../components/UnitChatProfile';
import type { ChatLine } from './displayHelpers';

export type OrbItem = { id: string; emoji: string; title: string; subtitle: string };

export type { ChatLine };

export type ChatScope = {
  scope: 'one' | 'space' | 'unit';
  spaceId: SpaceId;
  domainId?: DomainId;
  unitId?: string;
};

export type FlowUnit = UnitChatProfileModel & {
  messages: ChatLine[];
  spaceId: SpaceId;
  domainId?: DomainId;
};

export type BroadcastMessage = { type: string; body: string };

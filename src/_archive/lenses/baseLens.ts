/**
 * Base Lens - Abstract class for all lens implementations
 */

import { Lens, Protocol, SubAgent, ProtocolStep, UIComponent } from '../types';

export abstract class BaseLens implements Lens {
  abstract id: string;
  abstract name: string;
  abstract category: Lens['category'];
  abstract capabilities: string[];
  abstract protocols: Protocol[];
  abstract agents: SubAgent[];
  abstract icon?: string;
  abstract description?: string;

  /**
   * Initialize the lens - called when lens is activated
   */
  abstract initialize(): Promise<void>;

  /**
   * Cleanup the lens - called when lens is deactivated
   */
  abstract cleanup(): Promise<void>;

  /**
   * Execute a protocol step
   */
  abstract executeStep(protocolId: string, stepId: string, data?: unknown): Promise<UIComponent[]>;

  /**
   * Handle user input for a protocol step
   */
  abstract handleInput(protocolId: string, stepId: string, input: unknown): Promise<UIComponent[]>;

  /**
   * Get available protocols for a given goal
   */
  abstract getProtocolsForGoal(goal: string): Protocol[];

  /**
   * Validate protocol execution context
   */
  abstract validateContext(context: Record<string, unknown>): boolean;
}


/**
 * OpenAI Service - Handles AI agent processing
 */

import OpenAI from 'openai';
import { AgentResponse, UIComponent } from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

export const openAIService = {
  async chat(message: string, sessionId: string, userId: string): Promise<AgentResponse> {
    if (!process.env.OPENAI_API_KEY) {
      // Return demo response if OpenAI is not configured
      return {
        text: `I received your message: "${message}". In a production environment, this would be processed by GPT-4. To enable AI processing, add your OPENAI_API_KEY to the .env file.`,
        status: 'idle'
      };
    }

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an AI agent operating system assistant for the ONE Platform. You help users accomplish life goals by building UI components dynamically during conversation.

When users ask for something that requires a form, input, or interactive component, you should suggest creating that component. Be helpful, concise, and action-oriented.

Your responses should be natural and conversational. If a user asks for something that would benefit from a UI component (like a form, list, chart, etc.), mention that you can create it for them.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const aiText = response.choices[0].message.content || '';
      
      // Simple parsing to detect if UI components should be created
      const uiComponents = this.extractUIComponents(aiText, message);

      return {
        text: aiText,
        uiComponents,
        status: 'idle'
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      return {
        text: 'Sorry, I encountered an error processing your message. Please try again.',
        status: 'error'
      };
    }
  },

  extractUIComponents(aiText: string, userMessage: string): UIComponent[] {
    const components: UIComponent[] = [];
    const lowerText = aiText.toLowerCase();
    const lowerMessage = userMessage.toLowerCase();

    // Detect if user wants to create a form
    if (lowerMessage.includes('form') || lowerMessage.includes('input') || 
        lowerMessage.includes('enter') || lowerMessage.includes('fill')) {
      components.push({
        id: `form_${Date.now()}`,
        type: 'form',
        props: {
          title: 'Input Form',
          fields: [
            { name: 'field1', type: 'text', label: 'Field 1' },
            { name: 'field2', type: 'text', label: 'Field 2' }
          ]
        },
        animation: {
          type: 'slide',
          duration: 300
        }
      });
    }

    // Detect if user wants to see a list
    if (lowerMessage.includes('list') || lowerMessage.includes('show') || 
        lowerMessage.includes('display') || lowerMessage.includes('items')) {
      components.push({
        id: `list_${Date.now()}`,
        type: 'list',
        props: {
          title: 'Items',
          items: ['Item 1', 'Item 2', 'Item 3']
        },
        animation: {
          type: 'fade',
          duration: 300
        }
      });
    }

    // Detect if user wants a card/display
    if (lowerMessage.includes('card') || lowerMessage.includes('show me') || 
        lowerMessage.includes('display')) {
      components.push({
        id: `card_${Date.now()}`,
        type: 'card',
        props: {
          title: 'Information',
          content: aiText.substring(0, 200)
        },
        animation: {
          type: 'fade',
          duration: 300
        }
      });
    }

    return components;
  }
};


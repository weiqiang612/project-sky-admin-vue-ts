import Vue from 'vue'
import { VuexModule, Module, Mutation, getModule } from 'vuex-module-decorators'
import store from '@/store'

export interface ChatMessage {
  role: 'user' | 'agent'
  content: string
  timestamp: number
  intent?: string | null
}

export interface ConfirmationFrame {
  intent: string
  orderId: string | null
  question: string
  reason: string
}

export interface IChatState {
  messages: ChatMessage[]
  loading: boolean
  pendingConfirmation: ConfirmationFrame | null
}

@Module({ dynamic: true, store, name: 'chat' })
class Chat extends VuexModule implements IChatState {
  public messages: ChatMessage[] = []
  public loading = false
  public pendingConfirmation: ConfirmationFrame | null = null

  @Mutation
  public PUSH_MESSAGE(message: ChatMessage) {
    this.messages.push(message)
  }

  @Mutation
  public APPEND_TOKEN(content: string) {
    if (this.messages.length === 0) {
      return
    }
    const index = this.messages.length - 1
    const message = this.messages[index]
    Vue.set(this.messages, index, {
      ...message,
      content: message.content + content,
    })
  }

  @Mutation
  public SET_MESSAGE_INTENT(payload: { index: number; intent: string | null }) {
    const message = this.messages[payload.index]
    if (!message) {
      return
    }
    message.intent = payload.intent
  }

  @Mutation
  public SET_LOADING(loading: boolean) {
    this.loading = loading
  }

  @Mutation
  public SET_CONFIRMATION(pendingConfirmation: ConfirmationFrame | null) {
    this.pendingConfirmation = pendingConfirmation
  }

  @Mutation
  public RESET() {
    this.messages = []
    this.loading = false
    this.pendingConfirmation = null
  }
}

export const ChatModule = getModule(Chat)

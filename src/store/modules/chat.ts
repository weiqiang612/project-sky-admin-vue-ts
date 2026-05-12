import { VuexModule, Module, Mutation, getModule } from 'vuex-module-decorators'
import store from '@/store'

export interface ChatMessage {
  role: 'user' | 'agent'
  content: string
  timestamp: number
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
    this.messages[this.messages.length - 1].content += content
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

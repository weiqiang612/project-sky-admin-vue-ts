import { ChatModule } from '@/store/modules/chat'

describe('chat store module', () => {
  beforeEach(() => {
    ChatModule.RESET()
  })

  it('PUSH_MESSAGE appends a chat message', () => {
    ChatModule.PUSH_MESSAGE({ role: 'user', content: 'hello', timestamp: 1 })
    expect(ChatModule.messages).toHaveLength(1)
    expect(ChatModule.messages[0]).toEqual({ role: 'user', content: 'hello', timestamp: 1 })
  })

  it('APPEND_TOKEN concatenates onto the last message', () => {
    ChatModule.PUSH_MESSAGE({ role: 'agent', content: '', timestamp: 1 })
    ChatModule.APPEND_TOKEN('hi')
    ChatModule.APPEND_TOKEN(' there')
    expect(ChatModule.messages[0].content).toBe('hi there')
  })

  it('SET_CONFIRMATION updates and clears the pending confirmation', () => {
    ChatModule.SET_CONFIRMATION({
      intent: 'CANCEL_ORDER',
      orderId: 'order-1',
      question: 'Confirm cancel?',
      reason: 'Need user confirmation',
    })
    expect(ChatModule.pendingConfirmation).toEqual({
      intent: 'CANCEL_ORDER',
      orderId: 'order-1',
      question: 'Confirm cancel?',
      reason: 'Need user confirmation',
    })
    ChatModule.SET_CONFIRMATION(null)
    expect(ChatModule.pendingConfirmation).toBeNull()
  })

  it('RESET clears all chat state', () => {
    ChatModule.PUSH_MESSAGE({ role: 'user', content: 'hello', timestamp: 1 })
    ChatModule.SET_LOADING(true)
    ChatModule.SET_CONFIRMATION({
      intent: 'CHANGE_ADDRESS',
      orderId: null,
      question: 'Confirm change?',
      reason: 'Need confirmation',
    })
    ChatModule.RESET()
    expect(ChatModule.messages).toEqual([])
    expect(ChatModule.loading).toBe(false)
    expect(ChatModule.pendingConfirmation).toBeNull()
  })
})

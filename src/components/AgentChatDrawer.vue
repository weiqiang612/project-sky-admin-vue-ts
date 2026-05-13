<template>
  <div class="agent-chat-drawer">
    <el-button
      class="agent-chat-drawer__trigger"
      type="primary"
      circle
      aria-label="Open AI assistant chat"
      @click="drawerVisible = true"
    >
      <span class="agent-chat-drawer__trigger-icon" aria-hidden="true">
        &#129302;
      </span>
    </el-button>

    <el-drawer
      :visible.sync="drawerVisible"
      direction="rtl"
      size="380px"
      :with-header="false"
      custom-class="agent-chat-drawer__panel"
    >
      <div class="agent-chat-drawer__shell">
        <div class="agent-chat-drawer__header">
          <div class="agent-chat-drawer__header-left">
            <div class="agent-chat-drawer__avatar" aria-hidden="true">
              &#129302;
            </div>
            <div class="agent-chat-drawer__title-group">
              <p class="agent-chat-drawer__title">
                苍穹管家
              </p>
              <p class="agent-chat-drawer__status">
                <span class="agent-chat-drawer__status-dot" />
                Online
              </p>
            </div>
          </div>
          <button
            class="agent-chat-drawer__close"
            type="button"
            aria-label="Close chat"
            @click="drawerVisible = false"
          >
            <span aria-hidden="true">&#215;</span>
          </button>
        </div>

        <el-scrollbar ref="scrollbar" class="agent-chat-drawer__scroll">
          <div
            class="agent-chat-drawer__messages"
            role="log"
            aria-live="polite"
          >
            <div
              v-for="(message, index) in messages"
              :key="message.timestamp + '-' + index"
              class="agent-chat-drawer__message"
              :class="'is-' + message.role"
            >
              <div class="agent-chat-drawer__message-body">
                <div
                  class="agent-chat-drawer__bubble"
                  :class="message.role === 'user' ? 'is-user' : 'is-agent'"
                >
                  <MarkdownRenderer
                    v-if="message.role === 'agent'"
                    :content="renderMessageContent(message.content)"
                  />
                  <template v-else>
                    {{ renderMessageContent(message.content) }}
                  </template>
                  <span
                    v-if="isStreamingMessage(index, message)"
                    class="agent-chat-drawer__cursor"
                    aria-hidden="true"
                  />
                </div>
                <div class="agent-chat-drawer__meta">
                  <span
                    v-if="message.role === 'agent' && message.intent"
                    class="agent-chat-drawer__badge"
                  >
                    &#128278; {{ formatIntent(message.intent) }}
                  </span>
                  <span class="agent-chat-drawer__timestamp">
                    {{ formatTime(message.timestamp) }}
                  </span>
                </div>
              </div>
            </div>

            <div
              v-if="showThinking"
              class="agent-chat-drawer__message is-agent"
            >
              <div class="agent-chat-drawer__message-body">
                <div
                  class="agent-chat-drawer__thinking"
                  aria-label="Agent is thinking"
                >
                  <span class="agent-chat-drawer__thinking-dot" />
                  <span class="agent-chat-drawer__thinking-dot" />
                  <span class="agent-chat-drawer__thinking-dot" />
                </div>
              </div>
            </div>

            <div
              v-if="pendingConfirmation"
              class="agent-chat-drawer__message is-agent"
            >
              <div class="agent-chat-drawer__message-body">
                <div class="agent-chat-drawer__bubble is-confirmation">
                  {{ pendingConfirmation.question }}
                </div>
                <div class="agent-chat-drawer__confirm-row">
                  <button
                    class="agent-chat-drawer__confirm-btn"
                    type="button"
                    @click="handleConfirm"
                  >
                    Confirm
                  </button>
                  <button
                    class="agent-chat-drawer__cancel-btn"
                    type="button"
                    @click="handleCancelConfirmation"
                  >
                    Cancel
                  </button>
                </div>
                <div class="agent-chat-drawer__meta">
                  <span class="agent-chat-drawer__badge is-confirmation">
                    &#9888; requires confirmation &#183;
                    {{ formatIntent(pendingConfirmation.intent) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </el-scrollbar>

        <div v-if="!pendingConfirmation" class="agent-chat-drawer__input">
          <el-input
            v-model="inputValue"
            class="agent-chat-drawer__textarea"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 3 }"
            placeholder="Type a message..."
            @keydown.enter.native.exact.prevent="handleSend"
          />
          <button
            v-if="loading"
            class="agent-chat-drawer__action is-stop"
            type="button"
            @click="handleStop"
          >
            <span class="agent-chat-drawer__stop-square" aria-hidden="true" />
            Stop
          </button>
          <button
            v-else
            class="agent-chat-drawer__action is-send"
            type="button"
            :disabled="!inputValue.trim()"
            @click="handleSend"
          >
            Send
          </button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator'
import { getToken } from '@/utils/cookies'
import { ChatModule, ChatMessage } from '@/store/modules/chat'
import { UserModule } from '@/store/modules/user'
import MarkdownRenderer from './MarkdownRenderer.vue'

type CryptoWithRandomUUID = Crypto & { randomUUID: () => string }

@Component({
  name: 'AgentChatDrawer',
  components: { MarkdownRenderer },
})
export default class extends Vue {
  private drawerVisible = false
  private inputValue = ''
  private conversationId = ''
  private socket: WebSocket | null = null
  private streamingMessageIndex = -1
  private stopFallbackTimer: number | null = null

  get messages() {
    return ChatModule.messages
  }

  get loading() {
    return ChatModule.loading
  }

  get pendingConfirmation() {
    return ChatModule.pendingConfirmation
  }

  get showThinking() {
    return (
      this.loading &&
      this.streamingMessageIndex < 0 &&
      !this.pendingConfirmation
    )
  }

  get userId() {
    const userInfo = UserModule.userInfo as any
    return userInfo.id || userInfo.userId || ''
  }

  @Watch('drawerVisible')
  private onDrawerVisibleChange(visible: boolean) {
    if (visible) {
      this.resetSession(false)
      this.conversationId = this.createConversationId()
      this.connectSocket()
      return
    }
    this.closeSocket()
    this.resetSession(true)
  }

  destroyed() {
    this.clearStopFallbackTimer()
    this.closeSocket()
  }

  private createConversationId() {
    return (window.crypto as CryptoWithRandomUUID).randomUUID()
  }

  private resetSession(clearConversationId: boolean) {
    this.clearStopFallbackTimer()
    ChatModule.RESET()
    this.inputValue = ''
    this.streamingMessageIndex = -1
    if (clearConversationId) {
      this.conversationId = ''
    }
  }

  private connectSocket() {
    const token = getToken() || ''
    this.socket = new WebSocket(
      `${process.env.VUE_APP_WS_URL}?token=${encodeURIComponent(token)}`
    )
    this.socket.onmessage = (event) => this.handleSocketMessage(event)
    this.socket.onerror = () => {
      this.clearStopFallbackTimer()
      ChatModule.SET_LOADING(false)
      this.streamingMessageIndex = -1
      this.$message.error('WebSocket connection failed')
    }
    this.socket.onclose = () => {
      this.clearStopFallbackTimer()
      if (this.loading) {
        ChatModule.SET_LOADING(false)
      }
      this.streamingMessageIndex = -1
    }
  }

  private closeSocket() {
    this.clearStopFallbackTimer()
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  private handleSocketMessage(event: MessageEvent) {
    const frame = JSON.parse(event.data)
    if (frame.type === 'token') {
      this.handleTokenFrame(frame.content)
      return
    }
    if (frame.type === 'confirmation') {
      this.clearStopFallbackTimer()
      ChatModule.SET_LOADING(false)
      this.streamingMessageIndex = -1
      ChatModule.SET_CONFIRMATION(frame)
      this.scrollToBottom()
      return
    }
    if (frame.type === 'done') {
      this.clearStopFallbackTimer()
      if (frame.intent && this.streamingMessageIndex >= 0) {
        ChatModule.SET_MESSAGE_INTENT({
          index: this.streamingMessageIndex,
          intent: frame.intent,
        })
      }
      ChatModule.SET_LOADING(false)
      this.streamingMessageIndex = -1
      this.scrollToBottom()
      return
    }
    if (frame.type === 'cancelled') {
      this.clearStopFallbackTimer()
      ChatModule.SET_LOADING(false)
      this.streamingMessageIndex = -1
      this.scrollToBottom()
      return
    }
    if (frame.type === 'error') {
      this.clearStopFallbackTimer()
      ChatModule.SET_LOADING(false)
      this.streamingMessageIndex = -1
      this.$message.error(frame.message)
      this.scrollToBottom()
    }
  }

  private handleTokenFrame(content: string) {
    if (!this.loading && this.streamingMessageIndex < 0) return

    if (this.streamingMessageIndex < 0) {
      // 第一个 Token — 在创建气泡前剔除开头的空白字符/换行
      const cleaned = content.replace(/^[\n\r\s]+/, '')
      if (!cleaned) return // 如果第一个 Token 全是空白，直接跳过不处理

      this.streamingMessageIndex = this.messages.length
      ChatModule.PUSH_MESSAGE({
        role: 'agent',
        content: cleaned,
        timestamp: Date.now(),
        intent: null,
      })
      this.scrollToBottom()
      return
    }
    ChatModule.APPEND_TOKEN(content)
    this.scrollToBottom()
  }

  private handleSend() {
    const content = this.sanitizeInput(this.inputValue)
    if (
      !content ||
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN ||
      this.loading
    ) {
      return
    }
    ChatModule.PUSH_MESSAGE({
      role: 'user',
      content,
      timestamp: Date.now(),
      intent: null,
    })
    ChatModule.SET_LOADING(true)
    this.streamingMessageIndex = -1
    this.socket.send(
      JSON.stringify({
        conversationId: this.conversationId,
        userId: this.userId,
        message: content,
      })
    )
    this.inputValue = ''
    this.scrollToBottom()
  }

  private handleStop() {
    if (
      !this.loading ||
      !this.socket ||
      this.socket.readyState !== WebSocket.OPEN
    ) {
      return
    }
    this.socket.send(
      JSON.stringify({
        type: 'cancel',
        conversationId: this.conversationId,
      })
    )
    this.startStopFallbackTimer()
  }

  private handleConfirm() {
    if (
      !this.socket ||
      !this.pendingConfirmation ||
      this.socket.readyState !== WebSocket.OPEN
    ) {
      return
    }
    this.socket.send(
      JSON.stringify({
        conversationId: this.conversationId,
        userId: this.userId,
        confirmation: true,
        intent: this.pendingConfirmation.intent,
      })
    )
    ChatModule.SET_CONFIRMATION(null)
    ChatModule.SET_LOADING(true)
    this.streamingMessageIndex = -1
    this.scrollToBottom()
  }

  private handleCancelConfirmation() {
    ChatModule.SET_CONFIRMATION(null)
    ChatModule.SET_LOADING(false)
    this.streamingMessageIndex = -1
  }

  private startStopFallbackTimer() {
    this.clearStopFallbackTimer()
    this.stopFallbackTimer = window.setTimeout(() => {
      if (this.loading) {
        ChatModule.SET_LOADING(false)
      }
      this.streamingMessageIndex = -1
      this.stopFallbackTimer = null
    }, 3000)
  }

  private clearStopFallbackTimer() {
    if (this.stopFallbackTimer != null) {
      window.clearTimeout(this.stopFallbackTimer)
      this.stopFallbackTimer = null
    }
  }

  private isStreamingMessage(index: number, message: ChatMessage) {
    return (
      this.loading &&
      this.streamingMessageIndex === index &&
      message.role === 'agent'
    )
  }

  private formatTime(timestamp: number) {
    if (!timestamp) {
      return ''
    }
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  private formatIntent(intent: string) {
    return intent
  }

  private renderMessageContent(content: string) {
    if (!content) return ''

    // 彻底移除前导空白（防御性措施，处理 APPEND_TOKEN 拼接场景）
    content = content.trimStart()

    // 统一换行
    content = content.replace(/\r\n/g, '\n')

    // 去掉开头和结尾所有空行（使用 /g 标志彻底移除）
    content = content.replace(/^\s*\n+/g, '').replace(/\n+\s*$/g, '')

    // 删除连续空行
    content = content.replace(/\n\s*\n+/g, '\n')

    // 去掉每行开头/结尾多余空格
    content = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0) // 去掉完全空的行
      .join('\n')

    return content
  }

  private scrollToBottom() {
    this.$nextTick(() => {
      const scrollbar = this.$refs.scrollbar as any
      if (scrollbar && scrollbar.wrap) {
        scrollbar.wrap.scrollTop = scrollbar.wrap.scrollHeight
      }
    })
  }

  private sanitizeInput(content: string) {
    if (!content) return ''

    content = content.trimStart()
    content = content.replace(/\r\n/g, '\n')
    content = content.replace(/^\s*\n+/g, '').replace(/\n+\s*$/g, '')
    content = content.replace(/\n\s*\n+/g, '\n')
    content = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')

    return content
  }
}
</script>

<style lang="scss">
.agent-chat-drawer {
  &__trigger {
    position: fixed;
    right: 32px;
    bottom: 32px;
    z-index: 2000;
    width: 56px;
    height: 56px;
    padding: 0;
    border: 0;
    box-shadow: 0 14px 34px rgba(24, 61, 125, 0.28);
    background: #e6f1fb;
  }

  &__trigger:hover,
  &__trigger:focus {
    background: #dcebf9;
  }

  &__trigger-icon {
    font-size: 22px;
    line-height: 1;
    color: #111;
  }

  &__panel {
    .el-drawer__body {
      height: 100%;
      padding: 0;
    }
  }

  &__shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f8f7f5;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 auto;
    height: 72px;
    padding: 0 16px;
    border-bottom: 1px solid #e6e0d8;
    background: #fff;
  }

  &__header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #eaf3ff;
    font-size: 18px;
    line-height: 1;
  }

  &__title-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__title {
    margin: 0;
    font-size: 18px;
    line-height: 1.1;
    font-weight: 600;
    color: #111;
  }

  &__status {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    color: #555;
  }

  &__status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #1d9e75;
  }

  &__close {
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    appearance: none;
    font-family: inherit;
    background: transparent;
    color: #c7a98e;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
  }

  &__scroll {
    flex: 1 1 auto;
    min-height: 0;
    background: #f8f7f5;
  }

  &__messages {
    min-height: 100%;
    padding: 16px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__message {
    display: flex;
    flex-direction: column;
  }

  &__message.is-user {
    align-items: flex-end;
  }

  &__message.is-agent {
    align-items: flex-start;
  }

  &__message-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  &__bubble {
    max-width: 86%;
    padding: 9px 13px;
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-line;
    word-break: break-word;
    color: #111;
  }

  &__bubble.is-agent {
    align-self: flex-start;
    background: #fff;
    border: 0.5px solid #e0e0e0;
    border-radius: 16px 16px 16px 4px;
    padding: 9px 13px;
  }

  &__bubble.is-user {
    align-self: flex-end;
    min-width: 116px;
    background: #e6f1fb;
    border-radius: 16px 16px 4px 16px;
    white-space: pre-line;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
  }

  &__bubble.is-confirmation {
    max-width: 100%;
    padding: 14px 16px;
    background: #fff;
    border: 1px solid #e3ddd6;
    border-radius: 18px 18px 18px 6px;
  }

  &__cursor {
    display: inline-block;
    width: 2px;
    height: 16px;
    margin-left: 2px;
    vertical-align: middle;
    background: #2d5bdb;
    animation: agent-chat-drawer-blink 0.8s steps(1) infinite;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 6px;
  }

  &__timestamp {
    font-size: 11px;
    color: #a9a19a;
    text-align: center;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    align-self: flex-start;
    padding: 1px 10px;
    border-radius: 999px;
    border: 1px solid #e1ddd8;
    background: #f6f5f2;
    color: #b7b0a8;
    font-size: 11px;
    line-height: 1.2;
  }

  &__badge.is-confirmation {
    padding: 2px 10px;
    background: #f6f5f2;
  }

  &__thinking {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: #fff;
    border: 1px solid #e3ddd6;
    border-radius: 18px 18px 18px 6px;
  }

  &__thinking-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #b2b2b2;
    animation: agent-chat-drawer-bounce 1.2s infinite;
  }

  &__thinking-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  &__thinking-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  &__confirm-row {
    display: flex;
    gap: 12px;
    margin-top: 6px;
  }

  &__confirm-btn,
  &__cancel-btn {
    min-width: 104px;
    height: 34px;
    padding: 0 16px;
    appearance: none;
    font-family: inherit;
    border-radius: 3px;
    font-size: 15px;
    font-weight: 600;
    line-height: 32px;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease,
      color 0.15s ease;
  }

  &__confirm-btn {
    background: #ffbf00;
    border: 1px solid #ffbf00;
    color: #111;
  }

  &__confirm-btn:hover {
    background: #ffb800;
    border-color: #ffb800;
  }

  &__cancel-btn {
    background: #fff;
    border: 1px solid #cfd7e6;
    color: #7485a6;
  }

  &__cancel-btn:hover {
    border-color: #bfcadf;
    color: #5f6f90;
  }

  &__input {
    flex: 0 0 auto;
    display: flex;
    gap: 10px;
    align-items: flex-end;
    padding: 12px 16px 16px;
    border-top: 1px solid #e6e0d8;
    background: #fff;
  }

  &__textarea {
    flex: 1 1 auto;
  }

  &__textarea .el-textarea__inner {
    height: 48px;
    min-height: 48px !important;
    border-radius: 24px;
    padding: 8px 13px;
    font-size: 14px;
    line-height: 1.4;
    background: #f8f7f5;
    border: 1px solid #dfd7cd;
    color: #111;
    box-shadow: none;
    resize: none;
    text-align: left;
  }

  &__textarea .el-textarea__inner::placeholder {
    color: #b6b9c4;
  }

  &__textarea .el-textarea__inner:focus {
    border-color: #d7cfc3;
  }

  &__action {
    min-width: 92px;
    height: 48px;
    padding: 0 20px;
    appearance: none;
    font-family: inherit;
    border-radius: 24px;
    border: 1px solid transparent;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    line-height: 46px;
  }

  &__action.is-send {
    background: #f6efce;
    border-color: #efe2ab;
    color: #a99a69;
  }

  &__action.is-send:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  &__action.is-stop {
    background: #f1eddf;
    border-color: #ddd2b8;
    color: #8a7d58;
  }

  &__action.is-stop:hover {
    background: #ebe4ca;
  }

  &__stop-square {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: #8a7d58;
    display: inline-block;
    margin-right: 4px;
    vertical-align: middle;
  }
}

@keyframes agent-chat-drawer-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

@keyframes agent-chat-drawer-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  30% {
    transform: translateY(-5px);
    opacity: 1;
  }
}
</style>

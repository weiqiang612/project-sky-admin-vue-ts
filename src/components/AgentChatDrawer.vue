<template>
  <div class="agent-chat-drawer">
    <el-button
      class="agent-chat-drawer__trigger"
      type="primary"
      circle
      icon="el-icon-message"
      aria-label="Open AI assistant chat"
      @click="drawerVisible = true"
    />
    <el-drawer
      :visible.sync="drawerVisible"
      direction="rtl"
      size="380px"
      :with-header="false"
      custom-class="agent-chat-drawer__panel"
    >
      <div class="agent-chat-drawer__shell">
        <div class="agent-chat-drawer__header">
          <span>AI Assistant</span>
          <el-button
            type="text"
            icon="el-icon-close"
            aria-label="Close chat"
            @click="drawerVisible = false"
          />
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
              class="agent-chat-drawer__row"
              :class="'is-' + message.role"
            >
              <div class="agent-chat-drawer__bubble">
                {{ message.content }}
              </div>
            </div>
            <div
              v-if="pendingConfirmation"
              class="agent-chat-drawer__confirmation"
            >
              <div
                class="agent-chat-drawer__bubble agent-chat-drawer__bubble--confirmation"
              >
                {{ pendingConfirmation.question }}
              </div>
              <div class="agent-chat-drawer__actions">
                <el-button type="primary" size="mini" @click="handleConfirm">
                  Confirm
                </el-button>
                <el-button size="mini" @click="handleCancel">
                  Cancel
                </el-button>
              </div>
            </div>
          </div>
        </el-scrollbar>
        <div v-if="!pendingConfirmation" class="agent-chat-drawer__input">
          <el-input
            v-model="inputValue"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 3 }"
            placeholder="Type a message"
            :disabled="loading"
            @keydown.enter.native.exact.prevent="handleSend"
          />
          <el-button
            type="primary"
            :loading="loading"
            :disabled="loading || !inputValue.trim()"
            @click="handleSend"
          >
            Send
          </el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator'
import { getToken } from '@/utils/cookies'
import { ChatModule } from '@/store/modules/chat'
import { UserModule } from '@/store/modules/user'
type CryptoWithRandomUUID = Crypto & { randomUUID: () => string }

@Component({
  name: 'AgentChatDrawer',
})
export default class extends Vue {
  private drawerVisible = false
  private inputValue = ''
  private conversationId = ''
  private socket: WebSocket | null = null
  private agentStreamActive = false

  get messages() {
    return ChatModule.messages
  }
  get loading() {
    return ChatModule.loading
  }
  get pendingConfirmation() {
    return ChatModule.pendingConfirmation
  }
  get userId() {
    const userInfo = UserModule.userInfo as any
    return userInfo.id || userInfo.userId || ''
  }

  @Watch('drawerVisible')
  private onDrawerVisibleChange(visible: boolean) {
    if (visible) {
      this.resetSession(false)
      this.conversationId = (window.crypto as CryptoWithRandomUUID).randomUUID()
      this.connectSocket()
      return
    }
    this.closeSocket()
    this.resetSession(true)
  }

  destroyed() {
    this.closeSocket()
  }

  private resetSession(clearConversationId: boolean) {
    ChatModule.RESET()
    this.inputValue = ''
    this.agentStreamActive = false
    if (clearConversationId) this.conversationId = ''
  }
  private connectSocket() {
    const token = getToken() || ''
    this.socket = new WebSocket(
      `${process.env.VUE_APP_WS_URL}?token=${encodeURIComponent(token)}`
    )
    this.socket.onmessage = (event) => this.handleSocketMessage(event)
    this.socket.onerror = () => {
      ChatModule.SET_LOADING(false)
      this.$message.error('WebSocket 连接失败')
    }
  }
  private closeSocket() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  private handleSocketMessage(event: MessageEvent) {
    const frame = JSON.parse(event.data)
    if (frame.type === 'token') {
      if (!this.agentStreamActive) {
        ChatModule.PUSH_MESSAGE({
          role: 'agent',
          content: '',
          timestamp: Date.now(),
        })
        this.agentStreamActive = true
      }
      ChatModule.APPEND_TOKEN(frame.content)
      this.scrollToBottom()
      return
    }
    if (frame.type === 'confirmation') {
      this.agentStreamActive = false
      ChatModule.SET_CONFIRMATION(frame)
      this.scrollToBottom()
      return
    }
    if (frame.type === 'done') {
      this.agentStreamActive = false
      ChatModule.SET_LOADING(false)
      this.scrollToBottom()
      return
    }
    if (frame.type === 'error') {
      this.agentStreamActive = false
      ChatModule.SET_LOADING(false)
      this.$message.error(frame.message)
    }
  }

  private handleSend() {
    const content = this.inputValue.trim()
    if (!content || !this.socket || this.socket.readyState !== WebSocket.OPEN)
      return
    ChatModule.PUSH_MESSAGE({ role: 'user', content, timestamp: Date.now() })
    ChatModule.SET_LOADING(true)
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

  private handleConfirm() {
    if (
      !this.socket ||
      !this.pendingConfirmation ||
      this.socket.readyState !== WebSocket.OPEN
    )
      return
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
    this.scrollToBottom()
  }

  private handleCancel() {
    ChatModule.SET_CONFIRMATION(null)
    ChatModule.SET_LOADING(false)
  }
  private scrollToBottom() {
    this.$nextTick(() => {
      const scrollbar = this.$refs.scrollbar as any
      if (scrollbar && scrollbar.wrap)
        scrollbar.wrap.scrollTop = scrollbar.wrap.scrollHeight
    })
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
    box-shadow: 0 10px 30px rgba(24, 61, 125, 0.28);
  }

  &__panel {
    .el-drawer__body {
      height: 100%;
    }
  }

  &__shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 auto;
    height: 64px;
    padding: 0 16px;
    border-bottom: 1px solid rgba(24, 61, 125, 0.08);
    font-weight: 600;
    color: #183d7d;
  }

  &__scroll {
    flex: 1 1 auto;
  }

  &__messages {
    min-height: 100%;
    padding: 16px;
  }

  &__row,
  &__confirmation {
    display: flex;
    margin-bottom: 12px;
  }

  &__row.is-user {
    justify-content: flex-end;
  }

  &__row.is-agent {
    justify-content: flex-start;
  }

  &__bubble {
    max-width: 80%;
    padding: 10px 12px;
    border-radius: 14px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    background: #fff;
    color: #243447;
    box-shadow: 0 4px 12px rgba(18, 44, 88, 0.08);
  }

  &__row.is-user &__bubble {
    background: #2f6de1;
    color: #fff;
  }

  &__bubble--confirmation {
    background: #fff7e6;
    border: 1px solid #ffd591;
  }

  &__confirmation {
    flex-direction: column;
    align-items: flex-start;
  }

  &__actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  &__input {
    flex: 0 0 auto;
    display: flex;
    gap: 12px;
    padding: 16px;
    border-top: 1px solid rgba(24, 61, 125, 0.08);
    background: rgba(255, 255, 255, 0.72);
  }

  &__input .el-textarea {
    flex: 1 1 auto;
  }
}
</style>

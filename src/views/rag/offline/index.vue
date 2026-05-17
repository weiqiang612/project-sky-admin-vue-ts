<template>
  <div class="rag-offline-page">
    <div class="page-backdrop page-backdrop-a" />
    <div class="page-backdrop page-backdrop-b" />

    <div class="page-shell">
      <section class="hero-card">
        <div class="hero-copy">
          <div class="eyebrow">
            Offline RAG Workspace
          </div>
          <h1>离线知识库索引</h1>
          <p class="hero-description">
            上传文档后自动完成解析、分片、Embedding 和向量入库。页面只接入当前后端已开放的离线索引与文档列表接口。
          </p>

          <div class="hero-tags">
            <el-tag
              v-for="item in supportTags"
              :key="item"
              effect="plain"
              size="small"
              class="support-tag"
            >
              {{ item }}
            </el-tag>
          </div>
        </div>

        <div class="hero-stats">
          <div v-for="card in overviewCards" :key="card.label" class="stat-card">
            <span class="stat-label">{{ card.label }}</span>
            <strong class="stat-value">{{ card.value }}</strong>
            <small class="stat-tip">{{ card.tip }}</small>
          </div>
        </div>
      </section>

      <section class="main-grid">
        <div class="surface surface-upload">
          <div class="section-header">
            <div>
              <h2>索引文件</h2>
              <p>支持拖拽或点击选择文件，默认按文件后缀自动识别文档类型。</p>
            </div>
            <el-button type="text" :loading="loadingDocuments" @click="refreshDocuments">
              刷新列表
            </el-button>
          </div>

          <input
            ref="fileInput"
            class="file-input"
            type="file"
            :accept="acceptText"
            @change="handleFileChange"
          >

          <div
            class="drop-zone"
            :class="{ 'is-dragging': isDragging, 'has-file': !!selectedFile }"
            @click="openFilePicker"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onDrop"
          >
            <div v-if="selectedFile" class="file-preview">
              <div class="file-badge">
                <i class="el-icon-document" />
              </div>
              <div class="file-meta">
                <div class="file-name">
                  {{ selectedFile.name }}
                </div>
                <div class="file-sub">
                  {{ formatBytes(selectedFile.size) }} · {{ fileFormatHint }}
                </div>
              </div>
              <el-button type="text" class="link-btn" @click.stop="clearSelectedFile">
                重新选择
              </el-button>
            </div>

            <div v-else class="placeholder">
              <div class="placeholder-icon">
                <i class="el-icon-upload" />
              </div>
              <h3>拖拽文件到这里，或点击选择</h3>
              <p>支持 .jsonl、.qa、.md、.markdown、.pdf、.txt</p>
              <el-button type="primary" plain @click.stop="openFilePicker">
                选择文件
              </el-button>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-item">
              <label>文档类型</label>
              <el-select v-model="documentType" placeholder="自动识别" class="doc-type-select">
                <el-option
                  v-for="option in documentTypeOptions"
                  :key="option.value || 'auto'"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <p class="field-hint">
                手动指定会覆盖自动推断。建议和文件内容类型保持一致。
              </p>
            </div>

            <div class="form-item">
              <label>文件说明</label>
              <div class="file-note">
                <p>QA: 适合问答对数据，支持 JSONL / .qa / 纯文本问答格式。</p>
                <p>Markdown: 会按标题层级切分 section，再进行长度分块。</p>
                <p>PDF / TXT: 按段落优先切分，保留 120 字符重叠。</p>
              </div>
            </div>
          </div>

          <div class="action-row">
            <el-button type="primary" :loading="submitting" :disabled="!selectedFile" @click="submitIndex">
              开始索引
            </el-button>
            <el-button :disabled="!selectedFile && !lastResult" @click="clearSelectedFile">
              清空选择
            </el-button>
          </div>

          <transition name="fade-slide">
            <div v-if="lastResult" class="result-card">
              <div class="result-head">
                <div>
                  <h3>最近一次结果</h3>
                  <p>{{ resultMessage }}</p>
                </div>
                <el-tag :type="statusType(lastResult.status)" effect="plain">
                  {{ statusLabel(lastResult.status) }}
                </el-tag>
              </div>

              <div class="result-grid">
                <div class="result-item">
                  <span>文档</span>
                  <strong>{{ lastResult.sourceName }}</strong>
                </div>
                <div class="result-item">
                  <span>版本</span>
                  <strong>{{ lastResult.indexVersion }}</strong>
                </div>
                <div class="result-item">
                  <span>分片数</span>
                  <strong>{{ lastResult.chunkCount }}</strong>
                </div>
                <div class="result-item">
                  <span>类型</span>
                  <strong>{{ documentTypeLabel(lastResult.documentType) }}</strong>
                </div>
              </div>

              <div class="result-meta">
                <span>documentId: {{ lastResult.documentId }}</span>
              </div>
            </div>
          </transition>
        </div>

        <div class="surface surface-guide">
          <div class="section-header">
            <div>
              <h2>分片策略</h2>
              <p>后端当前按文档类型选择不同的 chunking strategy。</p>
            </div>
          </div>

          <div class="strategy-list">
            <article v-for="item in strategyCards" :key="item.title" class="strategy-card">
              <div class="strategy-head">
                <div>
                  <h3>{{ item.title }}</h3>
                  <p>{{ item.extensions }}</p>
                </div>
                <el-tag effect="plain" size="small">
                  {{ item.badge }}
                </el-tag>
              </div>
              <p class="strategy-desc">
                {{ item.description }}
              </p>
              <ul>
                <li v-for="point in item.points" :key="point">
                  {{ point }}
                </li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section class="surface surface-table">
        <div class="section-header">
          <div>
            <h2>索引记录</h2>
            <p>来自 `GET /rag/offline/documents` 的最新文档摘要。</p>
          </div>
          <span class="table-summary">共 {{ documents.length }} 条</span>
        </div>

        <el-table
          v-loading="loadingDocuments"
          :data="sortedDocuments"
          stripe
          class="rag-table"
          empty-text="暂无索引记录"
        >
          <el-table-column prop="sourceName" label="文件名" min-width="220" show-overflow-tooltip />
          <el-table-column label="类型" width="110">
            <template slot-scope="scope">
              <el-tag size="small" effect="plain">
                {{ documentTypeLabel(scope.row.documentType) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="indexVersion" label="版本" min-width="180" show-overflow-tooltip />
          <el-table-column prop="chunkCount" label="分片数" width="100" align="center" />
          <el-table-column label="状态" width="160" align="center">
            <template slot-scope="scope">
              <el-tag :type="statusType(scope.row.status)" size="small" effect="plain">
                {{ statusLabel(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="190">
            <template slot-scope="scope">
              {{ formatTime(scope.row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="190">
            <template slot-scope="scope">
              {{ formatTime(scope.row.updatedAt) }}
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import moment from 'moment'
import {
  getOfflineRagDocuments,
  indexOfflineRag,
  OfflineIndexResponse,
  RagDocumentStatus,
  RagDocumentSummary,
  RagDocumentType
} from '@/api/ragOffline'

type NullableRagDocumentType = RagDocumentType | ''

interface StrategyCard {
  title: string
  badge: string
  extensions: string
  description: string
  points: string[]
}

@Component({
  name: 'OfflineRagIndex'
})
export default class extends Vue {
  private selectedFile: File | null = null
  private documentType: NullableRagDocumentType = ''
  private documents: RagDocumentSummary[] = []
  private lastResult: OfflineIndexResponse | null = null
  private loadingDocuments: boolean = false
  private submitting: boolean = false
  private isDragging: boolean = false

  private readonly acceptText = '.jsonl,.qa,.md,.markdown,.pdf,.txt'
  private readonly supportedExtensions = ['.jsonl', '.qa', '.md', '.markdown', '.pdf', '.txt']
  private readonly unsupportedFileMessage = '当前上传的文档格式不支持，请上传 PDF、Markdown、TXT 或 QA(JSONL) 文件'

  private readonly documentTypeOptions = [
    { label: '自动识别', value: '', help: '按文件后缀自动判断' },
    { label: '问答 QA', value: 'QA', help: 'JSONL / .qa / 纯文本问答' },
    { label: 'Markdown', value: 'MARKDOWN', help: '按标题层级分片' },
    { label: 'PDF', value: 'PDF', help: '抽取文本后按段落切分' },
    { label: 'TXT', value: 'TXT', help: '纯文本按段落切分' }
  ]

  private readonly strategyCards: StrategyCard[] = [
    {
      title: 'QA',
      badge: '问答对',
      extensions: '.jsonl / .qa / 纯文本问答',
      description: '按问答对逐条解析，答案过长时继续拆分，适合结构化知识库。',
      points: [
        '支持 JSONL，每行一个问答对象。',
        '也支持 Q:/A:、Question:/Answer: 纯文本格式。',
        '适合 FAQ、SOP、客服知识库。'
      ]
    },
    {
      title: 'Markdown',
      badge: '标题分片',
      extensions: '.md / .markdown',
      description: '先按标题层级聚合 section，再按长度切块，保留章节语义。',
      points: [
        '以 # 到 ###### 的标题作为切分边界。',
        '每个 section 再按 1200 字符规则切分。',
        '保留标题路径，方便检索回溯。'
      ]
    },
    {
      title: 'PDF',
      badge: '段落优先',
      extensions: '.pdf',
      description: '先提取 PDF 文本，再按段落优先、长度上限 1500 字符切块。',
      points: [
        '段落优先，避免强行切断上下文。',
        '默认保留 120 字符重叠。',
        '当前按文本抽取流程，不做 OCR。'
      ]
    },
    {
      title: 'TXT',
      badge: '通用文本',
      extensions: '.txt',
      description: '适合纯文本知识材料，按段落优先、长度上限 1200 字符切块。',
      points: [
        '适合制度、说明、笔记和长文本资料。',
        '默认保留 120 字符重叠。',
        '内容会按空行和段落进行优先合并。'
      ]
    }
  ]

  private readonly supportTags = ['.jsonl', '.qa', '.md', '.markdown', '.pdf', '.txt']

  created() {
    this.refreshDocuments()
  }

  get overviewCards() {
    const total = this.documents.length
    const indexed = this.documents.filter((item) => item.status === 'INDEXED').length
    const processing = this.documents.filter((item) => item.status === 'PROCESSING').length
    const totalChunks = this.documents.reduce((sum, item) => sum + (item.chunkCount || 0), 0)

    return [
      { label: '文档总数', value: String(total), tip: '来自文档列表接口' },
      { label: '已索引', value: String(indexed), tip: '状态为 INDEXED' },
      { label: '处理中', value: String(processing), tip: '状态为 PROCESSING' },
      { label: '分片总数', value: String(totalChunks), tip: '已入库 chunk 统计' }
    ]
  }

  get sortedDocuments() {
    return [...this.documents].sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.createdAt || '').getTime()
      const rightTime = new Date(right.updatedAt || right.createdAt || '').getTime()
      return rightTime - leftTime
    })
  }

  get resultMessage() {
    if (!this.lastResult) {
      return ''
    }
    if (this.lastResult.status === 'INDEXED') {
      return '索引完成，文档与分片已写入向量库。'
    }
    if (this.lastResult.status === 'DUPLICATE_SKIPPED') {
      return '内容已存在，后端跳过了重复索引。'
    }
    if (this.lastResult.status === 'PROCESSING') {
      return '文档正在处理，列表会在刷新后更新状态。'
    }
    return '索引失败，请查看后端日志或重新上传。'
  }

  get fileFormatHint() {
    if (!this.selectedFile) {
      return '请选择文件'
    }
    return this.inferFileFormat(this.selectedFile.name)
  }

  private openFilePicker() {
    const fileInput = this.$refs.fileInput as HTMLInputElement
    if (fileInput) {
      fileInput.click()
    }
  }

  private handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    if (!target.files || !target.files.length) {
      return
    }
    const file = target.files[0]
    if (!this.isSupportedFile(file.name)) {
      this.clearSelectedFile()
      this.$message.error(this.getUnsupportedFileMessage(file.name))
      target.value = ''
      return
    }
    this.selectedFile = file
    this.lastResult = null
    this.documentType = ''
    target.value = ''
  }

  private onDragOver() {
    this.isDragging = true
  }

  private onDragLeave() {
    this.isDragging = false
  }

  private onDrop(event: DragEvent) {
    this.isDragging = false
    const files = event.dataTransfer ? event.dataTransfer.files : null
    if (!files || !files.length) {
      return
    }
    const file = files[0]
    if (!this.isSupportedFile(file.name)) {
      this.clearSelectedFile()
      this.$message.error(this.getUnsupportedFileMessage(file.name))
      return
    }
    this.selectedFile = file
    this.lastResult = null
    this.documentType = ''
  }

  private clearSelectedFile() {
    this.selectedFile = null
    this.lastResult = null
    this.documentType = ''

    const fileInput = this.$refs.fileInput as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  private async submitIndex() {
    if (!this.selectedFile) {
      this.$message.warning('请先选择文件')
      return
    }
    if (!this.isSupportedFile(this.selectedFile.name)) {
      this.$message.error(this.getUnsupportedFileMessage(this.selectedFile.name))
      return
    }

    this.submitting = true
    try {
      const response = await indexOfflineRag(this.selectedFile, this.documentType)
      const result = response.data as OfflineIndexResponse
      this.lastResult = result

      if (result.status === 'INDEXED') {
        this.$message.success('索引完成')
      } else if (result.status === 'DUPLICATE_SKIPPED') {
        this.$message.info('检测到重复内容，已跳过索引')
      } else if (result.status === 'PROCESSING') {
        this.$message.success('文档已提交处理')
      } else {
        this.$message.error('索引失败')
      }

      await this.refreshDocuments()
    } catch (error) {
      const message = this.getRequestErrorMessage(error, '离线索引提交失败')
      this.$message.error(message)
    } finally {
      this.submitting = false
    }
  }

  private async refreshDocuments() {
    this.loadingDocuments = true
    try {
      const response = await getOfflineRagDocuments()
      const data = response.data
      this.documents = Array.isArray(data) ? data : []
    } catch (error) {
      const message = this.getRequestErrorMessage(error, '文档列表加载失败')
      this.$message.error(message)
    } finally {
      this.loadingDocuments = false
    }
  }

  private formatTime(value: string) {
    if (!value) {
      return '-'
    }
    const time = moment(value)
    if (!time.isValid()) {
      return value
    }
    return time.format('YYYY-MM-DD HH:mm:ss')
  }

  private formatBytes(size: number) {
    if (!size && size !== 0) {
      return '-'
    }
    if (size < 1024) {
      return size + ' B'
    }
    if (size < 1024 * 1024) {
      return (size / 1024).toFixed(1) + ' KB'
    }
    return (size / 1024 / 1024).toFixed(1) + ' MB'
  }

  private inferFileFormat(fileName: string) {
    const lower = (fileName || '').toLowerCase()
    if (lower.endsWith('.jsonl') || lower.endsWith('.qa')) {
      return '推荐作为 QA 文件'
    }
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      return '推荐作为 Markdown 文件'
    }
    if (lower.endsWith('.pdf')) {
      return 'PDF 文本抽取'
    }
    if (lower.endsWith('.txt')) {
      return 'TXT 纯文本'
    }
    return '当前格式不受支持'
  }

  private isSupportedFile(fileName: string) {
    const lower = (fileName || '').toLowerCase()
    return this.supportedExtensions.some((extension) => lower.endsWith(extension))
  }

  private getUnsupportedFileMessage(fileName: string) {
    return `${this.unsupportedFileMessage}：${fileName}`
  }

  private getRequestErrorMessage(error: unknown, fallbackMessage: string) {
    const err = error as {
      message?: string
      response?: {
        data?: {
          message?: string
          msg?: string
          desc?: string
        }
      }
    }
    const response = err && err.response ? err.response : undefined
    const data = response && response.data ? response.data : undefined
    const backendMessage =
      (data && data.message) ||
      (data && data.msg) ||
      (data && data.desc)
    return backendMessage || (err && err.message) || fallbackMessage
  }

  private documentTypeLabel(value: RagDocumentType) {
    if (value === 'QA') {
      return 'QA'
    }
    if (value === 'MARKDOWN') {
      return 'Markdown'
    }
    if (value === 'PDF') {
      return 'PDF'
    }
    if (value === 'TXT') {
      return 'TXT'
    }
    return value
  }

  private statusLabel(value: RagDocumentStatus) {
    if (value === 'INDEXED') {
      return '已索引'
    }
    if (value === 'PROCESSING') {
      return '处理中'
    }
    if (value === 'DUPLICATE_SKIPPED') {
      return '已跳过重复'
    }
    if (value === 'FAILED') {
      return '失败'
    }
    return value
  }

  private statusType(value: RagDocumentStatus) {
    if (value === 'INDEXED') {
      return 'success'
    }
    if (value === 'PROCESSING') {
      return 'warning'
    }
    if (value === 'DUPLICATE_SKIPPED') {
      return 'info'
    }
    if (value === 'FAILED') {
      return 'danger'
    }
    return 'info'
  }
}
</script>

<style lang="scss" scoped>
.rag-offline-page {
  position: relative;
  min-height: calc(100vh - 84px);
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(84, 112, 198, 0.16), transparent 28%),
    radial-gradient(circle at 80% 12%, rgba(17, 24, 39, 0.08), transparent 22%),
    linear-gradient(180deg, #f7f8fb 0%, #eef2f8 100%);
  overflow: hidden;
}

.page-shell {
  position: relative;
  z-index: 1;
  max-width: 1440px;
  margin: 0 auto;
}

.page-backdrop {
  position: absolute;
  border-radius: 999px;
  filter: blur(40px);
  pointer-events: none;
}

.page-backdrop-a {
  top: 40px;
  right: -120px;
  width: 260px;
  height: 260px;
  background: rgba(76, 110, 245, 0.14);
}

.page-backdrop-b {
  left: -100px;
  bottom: 200px;
  width: 320px;
  height: 320px;
  background: rgba(99, 102, 241, 0.09);
}

.hero-card,
.surface {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
}

.hero-card {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 32px;
  margin-bottom: 24px;
}

.hero-copy {
  flex: 1;
  min-width: 0;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  margin-bottom: 16px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 0;
  color: #0f172a;
  font-size: 34px;
  line-height: 1.15;
  letter-spacing: -0.03em;
}

.hero-description {
  max-width: 760px;
  margin: 14px 0 0;
  color: #475569;
  font-size: 15px;
  line-height: 1.75;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.support-tag {
  border-color: rgba(76, 110, 245, 0.18);
  background: rgba(76, 110, 245, 0.06);
  color: #1e3a8a;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(150px, 1fr));
  gap: 12px;
  align-content: stretch;
  min-width: 320px;
}

.stat-card {
  padding: 18px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(248, 250, 252, 0.96) 100%);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.stat-label {
  display: block;
  color: #64748b;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.stat-value {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 28px;
  line-height: 1;
  letter-spacing: -0.03em;
}

.stat-tip {
  display: block;
  margin-top: 8px;
  color: #94a3b8;
  font-size: 12px;
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.9fr);
  gap: 24px;
}

.surface {
  padding: 24px;
}

.surface-upload {
  min-width: 0;
}

.surface-guide {
  min-width: 0;
}

.surface-table {
  margin-top: 24px;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.section-header h2 {
  margin: 0;
  color: #0f172a;
  font-size: 20px;
  line-height: 1.2;
}

.section-header p {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.table-summary {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.05);
  color: #334155;
  font-size: 12px;
  white-space: nowrap;
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: 24px;
  border: 1px dashed rgba(99, 102, 241, 0.22);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96) 0%, rgba(239, 246, 255, 0.72) 100%);
  transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
  cursor: pointer;
}

.drop-zone:hover,
.drop-zone.is-dragging {
  transform: translateY(-1px);
  border-color: rgba(76, 110, 245, 0.5);
  box-shadow: 0 16px 30px rgba(76, 110, 245, 0.08);
}

.file-preview,
.placeholder {
  width: 100%;
  text-align: center;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: left;
}

.file-badge,
.placeholder-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 18px;
  background: rgba(76, 110, 245, 0.12);
  color: #1d4ed8;
}

.file-badge {
  width: 54px;
  height: 54px;
  font-size: 24px;
}

.placeholder-icon {
  width: 72px;
  height: 72px;
  margin-bottom: 14px;
  font-size: 28px;
}

.placeholder h3 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
}

.placeholder p {
  margin: 10px 0 18px;
  color: #64748b;
  font-size: 13px;
}

.file-meta {
  flex: 1;
  min-width: 0;
}

.file-name {
  color: #0f172a;
  font-size: 16px;
  font-weight: 600;
  word-break: break-all;
}

.file-sub {
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
}

.link-btn {
  color: #1d4ed8;
}

.form-grid {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 18px;
  margin-top: 22px;
}

.form-item label {
  display: block;
  margin-bottom: 10px;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.doc-type-select {
  width: 100%;
}

.field-hint {
  margin: 8px 0 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.6;
}

.file-note {
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.file-note p {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
}

.file-note p + p {
  margin-top: 8px;
}

.action-row {
  display: flex;
  gap: 12px;
  margin-top: 22px;
}

.result-card {
  margin-top: 22px;
  padding: 18px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(249, 250, 251, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.result-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.result-head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 16px;
}

.result-head p {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.result-item {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.result-item span {
  display: block;
  color: #94a3b8;
  font-size: 12px;
}

.result-item strong {
  display: block;
  margin-top: 6px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
}

.result-meta {
  margin-top: 12px;
  color: #64748b;
  font-size: 12px;
  word-break: break-all;
}

.strategy-list {
  display: grid;
  gap: 14px;
}

.strategy-card {
  padding: 16px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96) 0%, rgba(255, 255, 255, 0.94) 100%);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.strategy-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.strategy-head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 16px;
}

.strategy-head p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
}

.strategy-desc {
  margin: 14px 0 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
}

.strategy-card ul {
  margin: 12px 0 0;
  padding-left: 18px;
  color: #334155;
  font-size: 13px;
  line-height: 1.7;
}

.strategy-card li + li {
  margin-top: 6px;
}

.rag-table {
  width: 100%;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.fade-slide-enter,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 1180px) {
  .hero-card {
    flex-direction: column;
  }

  .hero-stats {
    width: 100%;
    min-width: 0;
  }

  .main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .rag-offline-page {
    padding: 16px;
  }

  .hero-card,
  .surface {
    padding: 20px;
    border-radius: 22px;
  }

  .hero-copy h1 {
    font-size: 28px;
  }

  .hero-stats {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .result-grid {
    grid-template-columns: 1fr;
  }

  .action-row {
    flex-direction: column;
  }

  .file-preview {
    align-items: flex-start;
    flex-direction: column;
    text-align: left;
  }
}
</style>

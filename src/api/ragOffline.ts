import request from '@/utils/request'

export type RagDocumentType = 'QA' | 'MARKDOWN' | 'PDF' | 'TXT'
export type RagDocumentStatus = 'PROCESSING' | 'INDEXED' | 'DUPLICATE_SKIPPED' | 'FAILED'

export interface OfflineIndexResponse {
  documentId: string
  indexVersion: string
  documentType: RagDocumentType
  sourceName: string
  chunkCount: number
  status: RagDocumentStatus
}

export interface RagDocumentSummary {
  documentId: string
  sourceName: string
  documentType: RagDocumentType
  indexVersion: string
  status: RagDocumentStatus
  chunkCount: number
  createdAt: string
  updatedAt: string
}

export const indexOfflineRag = (file: File, documentType?: RagDocumentType | '') => {
  const formData = new FormData()
  formData.append('file', file)
  if (documentType) {
    formData.append('documentType', documentType)
  }

  return request({
    baseURL: process.env.VUE_APP_RAG_BASE_API || '/rag-api',
    url: '/rag/offline/index',
    method: 'post',
    data: formData,
    timeout: 600000
  })
}

export const getOfflineRagDocuments = () => {
  return request({
    baseURL: process.env.VUE_APP_RAG_BASE_API || '/rag-api',
    url: '/rag/offline/documents',
    method: 'get'
  })
}

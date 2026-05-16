import axios from 'axios'
import { UserModule } from '@/store/modules/user'
import {
  getRequestKey,
  removePending,
  checkPending,
  addPending,
  cancelPending
} from './requestOptimize'
import router from '@/router'

const CancelToken = axios.CancelToken

const service = axios.create({
  baseURL: process.env.VUE_APP_BASE_API,
  timeout: 600000
})

service.interceptors.request.use(
  (config: any) => {
    if (UserModule.token) {
      config.headers['token'] = UserModule.token
    }

    if (config.method === 'get' && config.params) {
      let url = config.url + '?'
      for (const propName of Object.keys(config.params)) {
        const value = config.params[propName]
        const part = encodeURIComponent(propName) + '='
        if (value !== null && typeof value !== 'undefined') {
          if (typeof value === 'object') {
            for (const key of Object.keys(value)) {
              const params = propName + '[' + key + ']'
              const subPart = encodeURIComponent(params) + '='
              url += subPart + encodeURIComponent(value[key]) + '&'
            }
          } else {
            url += part + encodeURIComponent(value) + '&'
          }
        }
      }
      url = url.slice(0, -1)
      config.params = {}
      config.url = url
    }

    const key = getRequestKey(config)
    if (checkPending(key)) {
      // Cancel the previous identical request and keep the latest one.
      cancelPending(key, '重复请求')
    }

    const source = CancelToken.source()
    config.cancelToken = source.token
    addPending(key, source.cancel)

    return config
  },
  (error: any) => Promise.reject(error)
)

service.interceptors.response.use(
  (response: any) => {
    if (response.data.status === 401) {
      router.push('/login')
    }

    if (response && response.config && response.config.url) {
      response.config.url = response.config.url.replace('/admin', '')
    }

    const key = getRequestKey(response.config)
    removePending(key)

    return response
  },
  (error: any) => {
    if (error && error.response) {
      switch (error.response.status) {
        case 401:
          router.push('/login')
          break
        case 405:
          error.message = '请求错误'
      }
    }

    if (error && error.config && error.config.url) {
      error.config.url = error.config.url.replace('/admin', '')
      const key = getRequestKey(error.config)
      removePending(key)
    }

    return Promise.reject(error)
  }
)

export default service

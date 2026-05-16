import md5 from 'md5'

// Build a stable key from url, method, and request payload.
const getRequestKey = (config) => {
  if (!config) {
    return md5(+new Date())
  }

  const data = typeof config.data === 'string' ? config.data : JSON.stringify(config.data)
  return md5(config.url + '&' + config.method + '&' + data)
}

// Map request key to the cancel function of the in-flight request.
const pending = {}

const checkPending = (key) => !!pending[key]

const removePending = (key) => {
  delete pending[key]
}

const addPending = (key, cancel) => {
  pending[key] = cancel
}

const cancelPending = (key, message = '重复请求') => {
  if (pending[key]) {
    pending[key](message)
    delete pending[key]
  }
}

export {
  getRequestKey,
  pending,
  checkPending,
  removePending,
  addPending,
  cancelPending
}

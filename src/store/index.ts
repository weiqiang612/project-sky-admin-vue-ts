import Vue from 'vue'
import Vuex from 'vuex'
import { IAppState } from './modules/app'
import { IChatState } from './modules/chat'
import { IUserState } from './modules/user'

Vue.use(Vuex)

export interface IRootState {
  app: IAppState
  chat: IChatState
  user: IUserState
}

export default new Vuex.Store<IRootState>({})

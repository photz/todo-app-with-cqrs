import {
  CQRS,
  makeCQRS,
  type Queries,
  type Commands
} from './cqrs'
import axios from 'axios'

type TodoID = string

type MyQueries = {
  me: {
    name: string
  },
  todos: Array<{
    id: TodoID
    done: boolean
    text: string
  }>,
  commandsSent: number
}

type MyCommands = {
  addTodo: {
    text: string,
    done: boolean
  },
  markDone: TodoID,
  delete: TodoID,
}

const queryClient = axios.create({
  baseURL: '/api/query',
})

const commandClient = axios.create({
  baseURL: '/api/command',
  method: 'post',
  headers: {
    'Content-Type': 'application/json'
  }
})

const invalidationRules = {
  addTodo: ['todos', 'commandsSent'] as Array<keyof MyQueries>,
  markDone: ['todos', 'commandsSent'] as Array<keyof MyQueries>,
  delete: ['todos', 'commandsSent'] as Array<keyof MyQueries>
}

export const {
  CQRSProvider,
  useCommands,
  useQuery
} = makeCQRS<MyQueries, MyCommands>({

  async dispatchQuery(queryType) {
    const resp = await queryClient({
      url: queryType,
    })

    return resp.data
  },

  async dispatchCommand({ type: commandType, args }: any) {
    await commandClient({
      url: commandType,
      data: args
    })
  },

  invalidationRules
})





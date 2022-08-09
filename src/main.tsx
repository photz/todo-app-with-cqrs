import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { CQRSProvider } from './my-cqrs'
import { QueryClientProvider, QueryClient } from 'react-query'
import { setupWorker, rest } from 'msw'
import { ChakraProvider } from '@chakra-ui/react'

const queryClient = new QueryClient

let todoSeq = 1

let commandsSent = 0

const todos: {
  [key: string]: { text: string, done: boolean }
} = {
  'first-todo': { text: 'wash the dishes', done: false }
}

const worker = setupWorker(
  rest.get('/api/query/todos', async (req, res, ctx) => {
    return res(
      ctx.json(
        Object.entries(todos)
          .map(([todoId, todoItem]) => ({ ...todoItem, id: todoId.toString() }))
      )
    )
  }),

  rest.get('/api/query/me', async (req, res, ctx) => {
    return res(
      ctx.json({
        name: 'john'
      })
    )
  }),

  rest.get('/api/query/commandsSent', (req, res, ctx) => res(ctx.json(commandsSent))),

  rest.post('/api/command/markDone', async (req, res, ctx) => {
    if (!req.body) throw Error('Todo ID required')
    if (typeof req.body !== 'string' && typeof req.body !== 'number') throw Error('Todo ID required')
    todos[req.body].done = true
    commandsSent++
    return res()
  }),

  rest.post('/api/command/delete', async (req, res, ctx) => {
    if (!req.body) throw Error('Todo ID required')
    if (typeof req.body !== 'string' && typeof req.body !== 'number') throw Error('Todo ID required')
    delete todos[req.body]
    commandsSent++;
    return res()
  }),

  rest.post('/api/command/addTodo', async (req, res, ctx) => {
    const newTodo = req.body as { text: string, done: boolean }
    todos[(todoSeq++).toString()] = newTodo
    commandsSent++;
    return res(
    )
  }),
)

worker.start().then(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <ChakraProvider>
        <QueryClientProvider client={queryClient}>
          <CQRSProvider>
            <App />
          </CQRSProvider>
        </QueryClientProvider>
      </ChakraProvider>
    </React.StrictMode>
  )
})

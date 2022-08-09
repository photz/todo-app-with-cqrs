import { useState } from 'react'
import {
  useCommands,
  useQuery
} from './my-cqrs'
import { Container, Box, Input, HStack, VStack } from '@chakra-ui/react'
import { Button, ButtonGroup } from '@chakra-ui/react'
import { Center, Spinner, IconButton } from '@chakra-ui/react'
import { CheckIcon, MinusIcon, AddIcon } from '@chakra-ui/icons'

function App() {
  const { sendCommand } = useCommands()

  const [newTodoText, setNewTodoText] = useState('')

  const handleSave = () => {
    if (newTodoText.length === 0) return
    sendCommand('addTodo', { text: newTodoText, done: false })
    setNewTodoText('')
  }

  const {
    isLoading: isLoadingTodos,
    data: todos
  } = useQuery('todos')

  const {
    isLoading: isLoadingMe,
    data: me
  } = useQuery('me')

  const {
    isLoading: isLoadingCommandsSent,
    data: commandsSent
  } = useQuery('commandsSent')

  return (
    <div className="App">
      <HStack background="orange" mb={10} justifyContent="space-between" py={1} px={3}>
        <div>{me ? `Welcome, ${me.name}` : 'Loading...'}</div>
        <div>{commandsSent}</div>
      </HStack>
      <Container>
        <HStack mb={10}>
          <Input
            placeholder="My new Todo"
            value={newTodoText}
            onInput={e => setNewTodoText((e.target as HTMLInputElement).value)}
          />
          <IconButton
            variant='outline'
            colorScheme='teal'
            aria-label='Delete'
            fontSize='20px'
            icon={<AddIcon />}
            onClick={handleSave}
          />
        </HStack>

        {
          isLoadingTodos
            ? <Center><Spinner /></Center>
            : (
              <VStack>
                {
                  todos
                    ? todos.map((todo, idx) =>
                      <HStack key={idx}>
                        <Input value={todo.text} onChange={e => null} />
                        <IconButton
                          variant='outline'
                          colorScheme={todo.done ? 'green' : 'gray'}
                          aria-label='Done'
                          fontSize='20px'
                          icon={<CheckIcon />}
                          onClick={() => sendCommand('markDone', todo.id)}
                        />
                        <IconButton
                          variant='outline'
                          colorScheme='red'
                          aria-label='Delete'
                          fontSize='20px'
                          icon={<MinusIcon />}
                          onClick={() => sendCommand('delete', todo.id)}
                        />
                      </HStack>
                    )
                    : null
                }
              </VStack>
            )
        }
      </Container>
    </div>
  )
}

export default App

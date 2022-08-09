import React, { ReactNode, createContext, useContext, FC, useReducer } from 'react'
import {
  useQuery as useReactQuery,
  useMutation,
  useQueryClient,
  MutationFunction,
  UseQueryResult
} from 'react-query'
import { useQueue } from './useQueue'

interface CommandsProviderContext<Q extends Queries, C extends Commands> {
  isLoading: boolean
  sendCommand: <CommandType extends keyof C>(commandType: CommandType, args: C[CommandType]) => Promise<void>
}

export type Queries = {
  [key: string]: any
}

export type Commands = {
  [key: string]: any
}

type DispatchCommand<Q extends Queries, C extends Commands> =
  <CommandType extends keyof C>(args: {
    type: CommandType,
    args: C[CommandType]
  }) => Promise<void>;

type DispatchQuery<Q extends Queries> =
  <QueryType extends keyof Q>(queryType: QueryType) => Promise<Q[QueryType]>;

interface MakeCQRSParams<Q extends Queries, C extends Commands> {
  dispatchCommand: DispatchCommand<Q, C>
  dispatchQuery: DispatchQuery<Q>
  invalidationRules: { [Property in keyof C]: Array<keyof Q> }
}

interface InvalidationState<Q extends Queries, C extends Commands> {
  [key: string]: keyof C
}

type DispatchID = string

type InvalidationAction<Q extends Queries, C extends Commands> =
  | { type: 'reset', ids: Array<DispatchID> }
  | { type: 'add', dispatchId: DispatchID, commandType: keyof C }

function invalidationReducer<Q extends Queries, C extends Commands>(
  state: InvalidationState<Q, C>,
  action: InvalidationAction<Q, C>
) {
  switch (action.type) {
    case 'reset':
      return {}

    case 'add':
      return {
        ...state,
        [action.dispatchId]: action.commandType
      }

    default:
      return state
  }
}

export interface CQRS<Q extends Queries, C extends Commands> {
  useCommands: () => CommandsProviderContext<Q, C>;
  useQuery: <QueryType extends keyof Q>(queryType: QueryType) => UseQueryResult<Q[QueryType]>
  CQRSProvider: FC<{ children: ReactNode }>
}

export function makeCQRS<Q extends Queries, C extends Commands>({
  dispatchCommand,
  dispatchQuery,
  invalidationRules
}: MakeCQRSParams<Q, C>) {

  let dispatchIdSeq = 0

  function getNextDispatchId(): string {
    return (dispatchIdSeq++).toString()
  }

  const context = createContext<CommandsProviderContext<Q, C> | undefined>(undefined)

  const CQRSProvider: FC<{ children: ReactNode }> = props => {
    const queryClient = useQueryClient()

    const [invalidations, dispatchInvalidation] = useReducer(invalidationReducer<Q, C>, {})

    async function invalidateQueries() {
      const dispatchIds = Object.keys(invalidations)

      const queryKeys = [] as Array<keyof Q>

      for (let commandType of Object.values(invalidations) ?? [] as Array<keyof C>) {
        for (let invalidatedQuery of invalidationRules[commandType] ?? [] as Array<keyof Q>) {

          if (!queryKeys.includes(invalidatedQuery)) {
            queryKeys.push(invalidatedQuery)
          }
        }
      }

      const promises = queryKeys.map(queryKey => queryClient.invalidateQueries([queryKey]))

      await Promise.all(promises)

      if (0 < queryKeys.length) {
        console.log('invalidated queries:', queryKeys)
      }

      dispatchInvalidation({ type: 'reset', ids: dispatchIds })
    }

    const { enqueue, empty, isLoading } = useQueue({
      onEmpty: invalidateQueries
    })

    const { mutateAsync } = useMutation(dispatchCommand as unknown as MutationFunction<any, any>, {
      retry: 1
    })

    const sendCommand = async <CommandType extends keyof C>(
      commandType: CommandType,
      args: C[CommandType]
    ): Promise<void> => {

      dispatchInvalidation({
        type: 'add',
        commandType: commandType,
        dispatchId: getNextDispatchId()
      })

      return enqueue(() => mutateAsync({ type: commandType, args }))
    }

    return (
      <context.Provider value={{ sendCommand, isLoading }}>
        {props.children}
      </context.Provider>
    )
  }

  const useCommands = (): CommandsProviderContext<Q, C> => {
    const value = useContext(context)

    if (value === undefined) {
      throw Error('useCommands() hook was called outsife of CommandsProvider context')
    }

    return value
  }

  const useQuery = <QueryType extends keyof Q>(queryType: QueryType) => {
    return useReactQuery(
      [queryType],
      () => dispatchQuery(queryType)
    )
  }

  return {
    useCommands,
    useQuery,
    CQRSProvider
  }
}

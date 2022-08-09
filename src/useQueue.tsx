import { useEffect, useReducer } from 'react';

type Task = () => Promise<any>;

export type QueueItem = {
  task: Task;
  callBack?: () => Promise<unknown> | void;
  onError?: (error?: unknown) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve?: (value: any) => void;
  reject?: (error?: unknown) => void;
};

type Enqueue = (
  /** Task to await before picking up next task */
  task: QueueItem['task'],
  /** Callback to perform directly after the task finished */
  callBack?: QueueItem['callBack'],
) => Promise<void>;

export type UseQueue = {
  enqueue: Enqueue;
  empty: () => void;
  isLoading: boolean;
};

type State = {
  queue: QueueItem[];
  isProcessing: boolean;
  previousQueueLength: number;
  isLoading: boolean;
};

const initialQueueState: State = {
  queue: [],
  isProcessing: false,
  previousQueueLength: 0,
  isLoading: false,
};

type Action =
  | {
    type: 'ENQUEUE';
    item: QueueItem;
  }
  | {
    type: 'DEQUEUE';
  }
  | {
    type: 'START_PROCESSING';
  }
  | {
    type: 'FINISHED_PROCESSING';
  }
  | {
    type: 'EMPTY';
  };

const taskQueueReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ENQUEUE':
      return {
        ...state,
        queue: [...state.queue, action.item],
        previousQueueLength: state.queue.length,
      };

    case 'DEQUEUE':
      return {
        ...state,
        queue: state.queue.filter((_task, index) => index !== 0),
        previousQueueLength: state.queue.length,
        isProcessing: false,
      };

    case 'START_PROCESSING':
      return {
        ...state,
        previousQueueLength: state.queue.length,
        isProcessing: true,
        isLoading: true,
      };

    case 'FINISHED_PROCESSING':
      return {
        ...state,
        previousQueueLength: state.queue.length,
        isProcessing: false,
        isLoading: false,
      };

    case 'EMPTY':
      return initialQueueState;

    default:
      return state;
  }
};

type UseQueueProps = {
  onEmpty?: () => Promise<unknown> | void;
};

/** Queue to persist the order in which async functions get resolved */
export const useQueue = ({ onEmpty }: UseQueueProps): UseQueue => {
  const [{ queue, isProcessing, previousQueueLength, isLoading }, dispatch] = useReducer(
    taskQueueReducer,
    initialQueueState,
  );
  const shouldPickUpNextTask = !isProcessing && queue[0];
  const shouldTriggerOnEmpty = !isProcessing && queue.length < previousQueueLength && queue.length === 0;

  const enqueue: Enqueue = async (task: QueueItem['task'], callBack?: QueueItem['callBack']) => {
    return new Promise((resolve, reject) => {
      dispatch({
        type: 'ENQUEUE',
        item: {
          task,
          callBack,
          resolve,
          reject,
        },
      });
    });
  };

  const empty = (): void => {
    dispatch({ type: 'EMPTY' });
  };

  const dispatchTask = async (): Promise<void> => {
    dispatch({ type: 'START_PROCESSING' });
    const item = queue[0];
    try {
      const result = await item.task();
      item.callBack && item.callBack();
      item.resolve && item.resolve(result);
    } catch (error) {
      item.onError && item.onError(error);
      item.reject && item.reject(error);
      throw error;
    } finally {
      dispatch({ type: 'DEQUEUE' });
    }
  };

  const dispatchOnEmpty = async (): Promise<void> => {
    dispatch({ type: 'START_PROCESSING' });
    await onEmpty?.();
    dispatch({ type: 'FINISHED_PROCESSING' });
  };

  // Go through queue
  useEffect(() => {
    if (shouldPickUpNextTask) {
      void dispatchTask();
    }
    if (shouldTriggerOnEmpty) {
      void dispatchOnEmpty();
    }
  }, [queue, isProcessing]);

  return { enqueue, empty, isLoading };
};

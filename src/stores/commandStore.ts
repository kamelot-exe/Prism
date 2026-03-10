import { writable } from 'svelte/store';
import type { ParsedCommand } from '../lib/command/commandTypes';
import { tasksStore } from './tasksStore';
import { eventsStore } from './eventsStore';
import { toastStore } from './toastStore';
import { normalizeDate } from '../lib/dates/safeDate';

function createCommandStore() {
  const { subscribe, set } = writable<boolean>(false);
  const { subscribe: subscribeLastCommand, set: setLastCommand } = writable<ParsedCommand | null>(null);

  function open() {
    set(true);
  }

  function close() {
    set(false);
    setLastCommand(null);
  }

  async function execute(command: ParsedCommand): Promise<void> {
    try {
      if (command.type === 'event') {
        const start = command.startTime || new Date();
        const end = command.endTime || new Date(start.getTime() + 60 * 60 * 1000);

        await eventsStore.create({
          title: command.title,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        });

        toastStore.showSuccess(`Event "${command.title}" created`);
      } else {
        const date = command.date ? normalizeDate(command.date) : null;

        await tasksStore.create(
          command.title,
          date,
          command.priority || 'normal',
          command.isFocus || false,
          null
        );

        const focusText = command.isFocus ? ' (focus)' : '';
        toastStore.showSuccess(`Task "${command.title}" created${focusText}`);
      }

      close();
    } catch (err) {
      console.error('Failed to execute command', err);
      toastStore.showError('Could not create item');
    }
  }

  return {
    subscribe,
    open,
    close,
    lastCommand: { subscribe: subscribeLastCommand },
    execute,
  };
}

export const commandStore = createCommandStore();


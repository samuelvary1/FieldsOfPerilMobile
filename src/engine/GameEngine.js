import nlp from 'compromise';
import Fuse from 'fuse.js';
import get from 'lodash/get';
import {createMachine, interpret} from 'xstate';
import {Story} from 'inkjs';

export function evaluateCommand(input, game, setGame) {
  const location = game.rooms[game.player.location];
  let output = '';

  // Stop words and default responses
  const stopWords = ['to', 'at', 'the', 'a', 'an', 'on', 'in', 'with', 'into'];
  const defaultItemResponses = {
    take: "That thing won't budge.",
    use: "You can't think of a way to use that right now.",
    talk: "It doesn't seem to have anything to say.",
    open: "You can't open that.",
    read: 'There’s nothing to read here.',
    examine: "There's nothing particularly interesting.",
  };

  // Command alias map
  const aliasMap = {
    grab: 'take',
    'pick up': 'take',
    pickup: 'take',
    walk: 'go',
    head: 'go',
    move: 'go',
    inspect: 'examine',
    check: 'examine',
    talk: 'talk',
    speak: 'talk',
    look: 'look',
    see: 'look',
    hint: 'hint',
  };

  // Handle compound commands
  const cleanedInput = input.toLowerCase().trim();
  const subCommands = cleanedInput
    .split(/(?:\s+and\s+|\s*;\s*|\s+then\s+)/)
    .map(cmd => cmd.trim())
    .filter(Boolean);

  for (let subCmd of subCommands) {
    const result = evaluateSingleCommand(
      subCmd,
      game,
      setGame,
      aliasMap,
      stopWords,
      defaultItemResponses,
    );
    output += result + '\n';
  }

  return output.trim();
}

function evaluateSingleCommand(
  input,
  game,
  setGame,
  aliasMap,
  stopWords,
  defaultItemResponses,
) {
  const location = game.rooms[game.player.location];
  let output = '';

  const doc = nlp(input);
  let command = doc.verbs().out('array')[0] || input.split(/\s+/)[0];
  command = aliasMap[command] || command;

  const nounParts = input
    .split(/\s+/)
    .slice(1)
    .filter(w => !stopWords.includes(w));
  const noun = nounParts.join(' ');

  const normalize = word => (word?.endsWith('s') ? word.slice(0, -1) : word);

  const fuse = new Fuse(Object.values(game.items), {
    keys: ['handle', 'alt_handle'],
    threshold: 0.3,
  });

  const getItemByHandle = name => {
    const normalized = normalize(name);
    const exact = Object.values(game.items).find(
      item => item.handle === normalized || item.alt_handle === normalized,
    );
    if (exact) {
      return exact;
    }
    const result = fuse.search(normalized);
    return result.length > 0 ? result[0].item : null;
  };

  const performItemAction = (itemName, action) => {
    const item = getItemByHandle(itemName);
    if (!item) {
      return `You don't see a "${itemName}" here.`;
    }
    if (action === 'take' && get(item, 'mobile') === false) {
      return defaultItemResponses.take;
    }
    const feedback =
      item.responses?.[action] ||
      defaultItemResponses[action] ||
      'Nothing happens.';
    return `You ${action} the ${item.handle}. ${feedback}`;
  };

  const guardDialogue = createMachine({
    id: 'guard',
    initial: 'idle',
    states: {
      idle: {
        on: {TALK: 'intro'},
      },
      intro: {
        entry: () => {
          output = 'Guard: Halt! Who goes there?';
        },
        on: {ASK_KEY: 'giveKey', BYE: 'idle'},
      },
      giveKey: {
        entry: () => {
          output = 'Guard: Here, take this key.';
        },
        type: 'final',
      },
    },
  });
  const guardService = interpret(guardDialogue).start();

  switch (command) {
    case 'look':
      if (noun) {
        // Redirect "look at box", "look in chest", etc. to examine
        command = 'examine';
        output = performItemAction(noun, command);
      } else {
        output = location.description || 'You look around.';
      }
      break;
    case 'l':
      output = location.description || 'You look around.';
      break;

    case 'go':
      output = handleMovement(noun, game, setGame);
      break;

    case 'inventory':
    case 'i':
      output = game.player.inventory.length
        ? `You are carrying: ${game.player.inventory.join(', ')}`
        : "You're not carrying anything.";
      break;

    case 'hint':
      output = location.hint || "You don't notice anything in particular.";
      break;

    case 'help':
    case 'h':
      output = game.messages.help;
      break;

    case 'use':
    case 'talk':
    case 'open':
    case 'read':
    case 'examine':
    case 'take':
      if (!noun) {
        output = `What do you want to ${command}?`;
      } else {
        if (noun.includes('guard')) {
          guardService.send('TALK');
        } else {
          output = performItemAction(noun, command);
        }
      }
      break;

    default:
      output = "I don't understand that command.";
      break;
  }

  return output;
}

function handleMovement(direction, game, setGame) {
  const currentRoom = game.rooms[game.player.location];
  const nextRoomKey = currentRoom.rooms?.[direction];

  if (!nextRoomKey) {
    return `You can't go ${direction} from here.`;
  }

  const nextRoom = game.rooms[nextRoomKey];

  setGame(prevGame => ({
    ...prevGame,
    player: {
      ...prevGame.player,
      location: nextRoomKey,
    },
    rooms: {
      ...prevGame.rooms,
      [nextRoomKey]: {
        ...nextRoom,
        been_before: true,
      },
    },
  }));

  return !nextRoom.been_before
    ? nextRoom.first_time_message || 'You enter a new place.'
    : nextRoom.header || 'You arrive.';
}

// gameEngine.js
import Fuse from 'fuse.js';
import get from 'lodash/get';
import {createMachine, interpret} from 'xstate';

// Dedicated movement keys
export const DIR = {
  N: 'north',
  S: 'south',
  E: 'east',
  W: 'west',
  U: 'up',
  D: 'down',
};

// Optional phrase mapping if you still accept "go north" in text
const directionAliases = {
  north: DIR.N,
  n: DIR.N,
  south: DIR.S,
  s: DIR.S,
  east: DIR.E,
  e: DIR.E,
  west: DIR.W,
  w: DIR.W,
  up: DIR.U,
  u: DIR.U,
  ascend: DIR.U,
  upstairs: DIR.U,
  climbup: DIR.U,
  down: DIR.D,
  d: DIR.D,
  descend: DIR.D,
  downstairs: DIR.D,
  climbdown: DIR.D,
};

// Shared helpers
const normalize = w => (w?.endsWith('s') ? w.slice(0, -1) : w);

function makeItemSearch(game) {
  return new Fuse(Object.values(game.items), {
    keys: ['handle', 'alt_handle', 'name'],
    threshold: 0.3,
  });
}

function getItemByHandle(name, game, fuse) {
  if (!name) {
    return null;
  }
  const q = normalize(name.toLowerCase());
  const exact = Object.values(game.items).find(
    it =>
      it.handle === q || it.alt_handle === q || it.name?.toLowerCase() === q,
  );
  if (exact) {
    return exact;
  }
  const res = fuse.search(q);
  return res.length ? res[0].item : null;
}

const defaultItemResponses = {
  take: 'That thing will not budge.',
  use: 'You cannot think of a way to use that right now.',
  talk: 'It does not seem to have anything to say.',
  open: 'You cannot open that.',
  read: 'There is nothing to read here.',
  examine: 'There is nothing particularly interesting.',
};

const aliasMap = {
  grab: 'take',
  pickup: 'take',
  'pick up': 'take',
  inspect: 'examine',
  check: 'examine',
  look: 'look',
  talk: 'talk',
  speak: 'talk',
  use: 'use',
  read: 'read',
  open: 'open',
  go: 'go', // optional compatibility
  move: 'go', // optional compatibility
  i: 'inventory',
  l: 'look',
  h: 'help',
};

// Simple dialogue example
function makeGuardService() {
  let output = '';
  const guardDialogue = createMachine({
    id: 'guard',
    initial: 'idle',
    states: {
      idle: {on: {TALK: 'intro'}},
      intro: {
        entry: () => {
          output = 'Guard: Halt. Who goes there?';
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
  const service = interpret(guardDialogue).start();
  return {service, getOutput: () => output};
}

// Public movement API for your UI
export function movePlayer(dir, game, setGame) {
  const d = dir in DIR ? DIR[dir] : directionAliases[`${dir}`.toLowerCase()];
  if (!d) {
    return 'Unknown direction.';
  }
  const currentRoom = game.rooms[game.player.location];
  const nextKey = currentRoom.rooms?.[d];
  if (!nextKey) {
    return `You cannot go ${d} from here.`;
  }

  const nextRoom = game.rooms[nextKey];
  if (!nextRoom) {
    return `Something blocks your way ${d}.`;
  }

  setGame(prev => ({
    ...prev,
    player: {...prev.player, location: nextKey},
    rooms: {
      ...prev.rooms,
      [nextKey]: {...nextRoom, been_before: true},
    },
  }));

  return !nextRoom.been_before
    ? nextRoom.first_time_message || 'You enter a new place.'
    : nextRoom.header || 'You arrive.';
}

// Optional guard to check movement without moving
export function canMove(dir, game) {
  const d = dir in DIR ? DIR[dir] : directionAliases[`${dir}`.toLowerCase()];
  if (!d) {
    return false;
  }
  const currentRoom = game.rooms[game.player.location];
  return Boolean(currentRoom.rooms?.[d]);
}

// Text command parser, with movement stripped out
export function evaluateCommand(input, game, setGame) {
  const location = game.rooms[game.player.location];
  const fuse = makeItemSearch(game);
  const {service: guardService, getOutput} = makeGuardService();

  const raw = `${input}`.toLowerCase().trim();

  // If the player types a single direction, do not parse it here
  if (directionAliases[raw]) {
    return 'Use the movement keys to move.';
  }

  // Tokenize simply and map first token through aliasMap
  const parts = raw.split(/\s+/);
  const mappedFirst = aliasMap[parts[0]] || parts[0];
  let command = mappedFirst;
  let rest = parts.slice(1).join(' ').trim();

  // Support "use X on Y"
  let noun = '';
  let target = '';
  if (rest.includes(' on ')) {
    const [a, b] = rest.split(' on ');
    noun = a.trim();
    target = b.trim();
  } else {
    noun = rest;
  }

  const performItemAction = (itemName, action) => {
    const item = getItemByHandle(itemName, game, fuse);
    if (!item) {
      return `You do not see a "${itemName}" here.`;
    }
    if (action === 'take' && get(item, 'properties.mobile') === false) {
      return 'That thing will not budge.';
    }
    return (
      item.responses?.[action] ||
      defaultItemResponses[action] ||
      'Nothing happens.'
    );
  };

  switch (command) {
    case 'help':
      return game.messages.help;

    case 'look': {
      if (raw.startsWith('look in ')) {
        const containerName = raw.replace('look in ', '');
        const container = getItemByHandle(containerName, game, fuse);
        if (!container) {
          return `You do not see a "${containerName}" here.`;
        }
        if (!container.properties?.container) {
          return `You cannot look inside the ${container.handle}.`;
        }
        if (!container.properties.open) {
          return `The ${container.handle} is closed.`;
        }
        const contents = container.contents || [];
        if (contents.length === 0) {
          return `The ${container.handle} is empty.`;
        }
        const names = contents.map(id => game.items[id]?.name || id).join(', ');
        return `Inside the ${container.handle}, you see: ${names}.`;
      }
      if (raw.startsWith('look at ')) {
        const itemName = raw.replace('look at ', '');
        const item = getItemByHandle(itemName, game, fuse);
        if (!item) {
          return `You do not see a "${itemName}" here.`;
        }
        return (
          item.description || `You see nothing special about the ${itemName}.`
        );
      }
      return location.description || 'You look around.';
    }

    case 'inventory': {
      const inv = game.player.inventory || [];
      return inv.length
        ? `You are carrying: ${inv.join(', ')}`
        : 'You are not carrying anything.';
    }

    case 'use': {
      if (noun && target) {
        const item = getItemByHandle(noun, game, fuse);
        const targetItem = getItemByHandle(target, game, fuse);
        if (!item || !targetItem) {
          return `You cannot use ${noun} on ${target}.`;
        }

        if (
          item.tags?.includes('key') &&
          targetItem.tags?.includes('access point') &&
          item.code &&
          targetItem.code &&
          item.code === targetItem.code
        ) {
          targetItem.properties.locked = false;
          return `You unlock the ${targetItem.handle} with the ${item.handle}.`;
        }
        return 'Nothing happens.';
      }
      if (!noun) {
        return 'Use what?';
      }
      return performItemAction(noun, 'use');
    }

    case 'talk': {
      if (!noun) {
        return 'Talk to whom?';
      }
      if (noun.includes('guard')) {
        guardService.send('TALK');
        return getOutput();
      }
      return performItemAction(noun, 'talk');
    }

    case 'open':
    case 'read':
    case 'examine': {
      if (!noun) {
        return `What do you want to ${command}?`;
      }
      return performItemAction(noun, command);
    }

    case 'take': {
      const item = getItemByHandle(noun, game, fuse);
      if (!item) {
        return `You do not see a "${noun}" here.`;
      }
      if (!item.properties?.mobile) {
        return 'That thing will not budge.';
      }
      if ((game.player.inventory || []).includes(item.handle)) {
        return `You already have the ${item.handle}.`;
      }
      // mutate in place then reflect in setGame if you prefer immutability
      game.player.inventory.push(item.handle);
      item.location = 'inventory';
      return `You take the ${item.handle}.`;
    }

    case 'go': {
      // Optional compatibility: allow "go north" to pass to movement API
      const d = directionAliases[noun];
      if (!d) {
        return 'Use the movement keys to move.';
      }
      return movePlayer(d, game, setGame);
    }

    default:
      return 'I do not understand that command.';
  }
}

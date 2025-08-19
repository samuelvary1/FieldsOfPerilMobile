// gameEngine.js
import Fuse from 'fuse.js';
import get from 'lodash/get';
import {createMachine, interpret} from 'xstate';

// Explicitly export the functions we need in GameUI
export {evaluateCommand}; // This is already defined below

// Function declarations

// Export all necessary functions

export const DIR = {
  N: 'north',
  S: 'south',
  E: 'east',
  W: 'west',
  U: 'up',
  D: 'down',
};

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

const normalize = w => (w?.endsWith('s') ? w.slice(0, -1) : w);
const deepClone = obj => JSON.parse(JSON.stringify(obj));

function makeItemSearch(game) {
  return new Fuse(Object.values(game.items), {
    keys: ['id', 'name'],
    threshold: 0.3,
  });
}

function getItemByHandle(name, game, fuse) {
  if (!name) {
    return null;
  }
  const q = normalize(name.toLowerCase());
  const exact = Object.values(game.items).find(
    it => it.id === q || it.name?.toLowerCase() === q,
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
  i: 'inventory',
  l: 'look',
  h: 'help',
  go: 'go',
  move: 'go',
  put: 'put',
  drop: 'drop',
  close: 'close',
  keypad: 'use',
};

// tiny dialogue example kept as before
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

// location helpers
function isInInventory(item, game) {
  return game.player.inventory.includes(item.id);
}
function isInCurrentRoom(item, game) {
  return item.location === game.player.location;
}
function isContainerOpen(container) {
  return (
    Boolean(container.properties?.container) &&
    Boolean(container.properties?.open)
  );
}
function ensureArray(a) {
  return Array.isArray(a) ? a : [];
}

// state mutation helpers
function setWith(updater, setGame) {
  setGame(prev => {
    const next = deepClone(prev);
    updater(next);
    return next;
  });
}

function addToInventory(itemId, game) {
  if (!game.player.inventory.includes(itemId)) {
    game.player.inventory.push(itemId);
  }
  if (game.items[itemId]) {
    game.items[itemId].location = 'inventory';
  }
}

function removeFromInventory(itemId, game) {
  game.player.inventory = game.player.inventory.filter(h => h !== itemId);
}

function putInRoom(itemId, roomKey, game) {
  if (game.items[itemId]) {
    game.items[itemId].location = roomKey;
  }
}

function putInContainer(itemId, containerId, game) {
  const container = game.items[containerId];
  if (!container) {
    return;
  }
  container.contains = ensureArray(container.contains);
  if (!container.contains.includes(itemId)) {
    container.contains.push(itemId);
  }
  if (game.items[itemId]) {
    game.items[itemId].location = containerId; // parent pointer
  }
}

function removeFromContainer(itemId, containerId, game) {
  const container = game.items[containerId];
  if (!container) {
    return;
  }
  container.contains = ensureArray(container.contains).filter(
    h => h !== itemId,
  );
}

// public movement API
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

  // Check if the direction is locked by a puzzle
  const accessPoint = currentRoom.access_points?.[d];
  if (accessPoint?.locked) {
    if (accessPoint.handle === 'entrance') {
      return 'The door is locked. There is a keypad here.';
    }
    return `The way ${d} is locked.`;
  }
  const nextRoom = game.rooms[nextKey];
  if (!nextRoom) {
    return `Something blocks your way ${d}.`;
  }

  setGame(prev => ({
    ...prev,
    player: {...prev.player, location: nextKey},
    rooms: {...prev.rooms, [nextKey]: {...nextRoom, been_before: true}},
  }));

  const fresh = !nextRoom.been_before;
  const roomText = fresh
    ? nextRoom.first_time_message || 'You enter a new place.'
    : nextRoom.header || 'You arrive.';
  const desc = nextRoom.description ? `\n\n${nextRoom.description}` : '';
  return roomText + desc;
}

function canMove(dir, game) {
  const d = dir in DIR ? DIR[dir] : directionAliases[`${dir}`.toLowerCase()];
  if (!d) {
    return false;
  }
  const currentRoom = game.rooms[game.player.location];
  return Boolean(currentRoom.rooms?.[d]);
}

// parser with drop and containers
function evaluateCommand(input, game, setGame) {
  const location = game.rooms[game.player.location];
  const fuse = makeItemSearch(game);
  const {service: guardService, getOutput} = makeGuardService();

  const raw = `${input}`.toLowerCase().trim();

  // If we're in keypad mode, treat any input as a code attempt
  if (game.keypadMode) {
    const keypad = getItemByHandle('keypad', game, fuse);
    const inputCode = Number(raw.trim());
    if (inputCode === keypad.code) {
      const currentRoom = game.rooms[game.player.location];
      if (currentRoom.access_points?.west) {
        setWith(next => {
          next.rooms[next.player.location].access_points.west.locked = false;
          next.keypadMode = false; // Exit keypad mode on success
        }, setGame);
        return 'The keypad beeps affirmatively and the door unlocks with a satisfying click.';
      } else {
        return 'Code accepted, but no west door found to unlock.';
      }
    }
    setGame(prev => ({
      ...prev,
      keypadMode: false, // Exit keypad mode on failure
    }));
    return "The keypad beeps negatively. That code doesn't work.";
  }

  if (directionAliases[raw]) {
    return 'Use the movement keys to move.';
  }

  const parts = raw.split(/\s+/);
  const mappedFirst = aliasMap[parts[0]] || parts[0];
  let command = mappedFirst;
  let rest = parts.slice(1).join(' ').trim();

  // parse common prepositions
  // pattern A: take x from y
  // pattern B: put x in y or put x into y
  let noun = '';
  let target = '';
  if (command === 'take' && rest.includes(' from ')) {
    const [a, b] = rest.split(' from ');
    noun = a.trim();
    target = b.trim();
  } else if (
    command === 'put' &&
    (rest.includes(' into ') || rest.includes(' in '))
  ) {
    const key = rest.includes(' into ') ? ' into ' : ' in ';
    const [a, b] = rest.split(key);
    noun = a.trim();
    target = b.trim();
  } else if (rest.includes(' on ')) {
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
          return `You cannot look inside the ${
            container.name || container.id
          }.`;
        }
        if (!container.properties.open) {
          return `The ${container.name || container.id} is closed.`;
        }
        // Set a flag that we've looked inside this container
        setWith(next => {
          next.state.flags = next.state.flags || {};
          next.state.flags[`looked_in_${container.id}`] = true;
        }, setGame);
        const contents = ensureArray(container.contains);
        if (contents.length === 0) {
          return `The ${container.name || container.id} is empty.`;
        }
        const names = contents.map(id => game.items[id]?.name || id).join(', ');
        return `Inside the ${
          container.name || container.id
        }, you see: ${names}.`;
      }
      if (raw.startsWith('look at ') || raw.startsWith('examine ')) {
        const itemName = raw.replace(/^(look at|examine) /, '');
        const item = getItemByHandle(itemName, game, fuse);
        if (!item) {
          return `You do not see a "${itemName}" here.`;
        }
        // Special case: if item is the letter, show its 'read' response if present
        if (item.id === 'letter' && item.responses?.read) {
          return item.responses.read;
        }
        let desc =
          item.description || `You see nothing special about the ${itemName}.`;
        if (item.properties?.container && item.properties.open) {
          const contents = Array.isArray(item.contains) ? item.contains : [];
          if (contents.length) {
            const names = contents
              .map(id => game.items[id]?.name || id)
              .join(', ');
            desc += ` Inside, you see: ${names}.`;
          } else {
            desc += ' It is empty.';
          }
        }
        return desc;
      }
      return location.description || 'You look around.';
    }

    case 'inventory': {
      const inv = game.player.inventory || [];
      if (!inv.length) {
        return 'You are not carrying anything.';
      }
      const list = inv.map(h => {
        const it = game.items[h];
        if (it?.properties?.container) {
          const c = ensureArray(it.contents);
          return `${it.name || it.handle} (${c.length} inside)`;
        }
        return it?.name || h;
      });
      return `You are carrying: ${list.join(', ')}`;
    }

    case 'open': {
      const item = getItemByHandle(noun, game, fuse);
      if (!item) {
        return `You do not see a "${noun}" here.`;
      }
      if (!item.properties?.container) {
        return performItemAction(noun, 'open');
      }
      if (item.properties.open) {
        return `The ${item.name || item.id} is already open.`;
      }
      setWith(next => {
        if (next.items[item.id]) {
          next.items[item.id].properties.open = true;
        }
      }, setGame);
      return `You open the ${item.name || item.id}.`;
    }

    case 'close': {
      const item = getItemByHandle(noun, game, fuse);
      if (!item) {
        return `You do not see a "${noun}" here.`;
      }
      if (!item.properties?.container) {
        return 'You cannot close that.';
      }
      if (!item.properties.open) {
        return `The ${item.handle} is already closed.`;
      }
      setWith(next => {
        if (next.items[item.id]) {
          next.items[item.id].properties.open = false;
        }
      }, setGame);
      return `You close the ${item.name || item.id}.`;
    }

    case 'take': {
      // take x from y
      if (noun && target) {
        const item = getItemByHandle(noun, game, fuse);
        const container = getItemByHandle(target, game, fuse);
        if (!item || !container) {
          return `You cannot take ${noun} from ${target}.`;
        }
        if (!container.properties?.container) {
          return `The ${container.name || container.id} is not a container.`;
        }
        if (!isContainerOpen(container)) {
          return `The ${container.name || container.id} is closed.`;
        }
        if (!ensureArray(container.contents).includes(item.id)) {
          return `There is no ${item.name || item.id} in the ${
            container.name || container.id
          }.`;
        }
        if (get(item, 'properties.mobile') === false) {
          return 'That thing will not budge.';
        }
        setWith(next => {
          removeFromContainer(item.id, container.id, next);
          addToInventory(item.id, next);
        }, setGame);
        return `You take the ${item.name || item.id} from the ${
          container.name || container.id
        }.`;
      }

      // take x from room, ground, or open/peeked container in current room
      const item = getItemByHandle(noun, game, fuse);
      if (!item) {
        return `You do not see a "${noun}" here.`;
      }
      const currentRoom = game.rooms[game.player.location];
      if (isInCurrentRoom(item, game)) {
        if (get(item, 'properties.mobile') === false) {
          return 'That thing will not budge.';
        }
        setWith(next => {
          addToInventory(item.id, next);
        }, setGame);
        return `You take the ${item.name || item.id}.`;
      }
      // Check if item is in an open, looked-in container in the current room
      const container = Object.values(game.items).find(
        c =>
          c.contains &&
          Array.isArray(c.contains) &&
          c.contains.includes(item.id) &&
          c.location === currentRoom.id &&
          c.properties?.container &&
          c.properties?.open &&
          game.state?.flags?.[`looked_in_${c.id}`],
      );
      if (container) {
        setWith(next => {
          removeFromContainer(item.id, container.id, next);
          addToInventory(item.id, next);
        }, setGame);
        return `You take the ${item.name || item.id} from the ${
          container.name || container.id
        }.`;
      }
      if (isInInventory(item, game)) {
        return `You already have the ${item.handle}.`;
      }
      return 'You cannot reach that here.';
    }

    case 'drop': {
      const item = getItemByHandle(noun, game, fuse);
      if (!item) {
        return `You are not carrying a "${noun}".`;
      }
      if (!isInInventory(item, game)) {
        return `You are not carrying the ${item.handle}.`;
      }
      setWith(next => {
        removeFromInventory(item.id, next);
        putInRoom(item.id, next.player.location, next);
      }, setGame);
      return `You drop the ${item.name || item.id}.`;
    }

    case 'put': {
      // put x in y
      const item = getItemByHandle(noun, game, fuse);
      const container = getItemByHandle(target, game, fuse);
      if (!item || !container) {
        return `You cannot put ${noun} in ${target}.`;
      }
      if (!isInInventory(item, game)) {
        return `You need to be holding the ${item.handle}.`;
      }
      if (!container.properties?.container) {
        return `The ${container.handle} is not a container.`;
      }
      // container can be in room or in inventory
      const containerHere =
        isInCurrentRoom(container, game) || isInInventory(container, game);
      if (!containerHere) {
        return `You do not see a ${container.handle} here.`;
      }
      if (!isContainerOpen(container)) {
        return `The ${container.handle} is closed.`;
      }
      if (
        container.properties?.capacity &&
        ensureArray(container.contents).length >= container.properties.capacity
      ) {
        return `The ${container.handle} is full.`;
      }
      setWith(next => {
        removeFromInventory(item.id, next);
        putInContainer(item.id, container.id, next);
      }, setGame);
      return `You put the ${item.name || item.id} in the ${
        container.name || container.id
      }.`;
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
          setWith(next => {
            if (next.items[targetItem.id]) {
              next.items[targetItem.id].properties.locked = false;
            }
          }, setGame);
          return `You unlock the ${targetItem.name || targetItem.id} with the ${
            item.name || item.id
          }.`;
        }
        return 'Nothing happens.';
      }
      if (!noun) {
        return 'Use what?';
      }

      // Special handling for the keypad
      if (noun === 'keypad') {
        const keypad = getItemByHandle('keypad', game, fuse);
        if (!keypad || !isInCurrentRoom(keypad, game)) {
          return 'There is no keypad here.';
        }

        // If this is just "use keypad" with no code, enter input mode
        if (!rest || rest === 'keypad') {
          setGame(prev => ({
            ...prev,
            keypadMode: true,
          }));
          return 'Enter the code for the keypad (just type the numbers):';
        }

        // If we have input, treat it as a code

        const code = Number(rest.replace('keypad', '').trim());
        if (code === keypad.code) {
          const currentRoom = game.rooms[game.player.location];
          if (currentRoom.access_points?.west?.handle === 'entrance') {
            setWith(next => {
              next.rooms[
                next.player.location
              ].access_points.west.locked = false;
              next.keypadMode = false; // Exit keypad mode on success
            }, setGame);
            return 'The keypad beeps affirmatively and the door unlocks with a satisfying click.';
          }
        }

        setGame(prev => ({
          ...prev,
          keypadMode: false, // Exit keypad mode on failure
        }));
        return "The keypad beeps negatively. That code doesn't work.";
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

    case 'open': // already handled above
    case 'read':
    case 'examine': {
      if (!noun) {
        return `What do you want to ${command}?`;
      }

      // Special handling for examining the keypad
      if (noun === 'keypad') {
        const keypad = getItemByHandle('keypad', game, fuse);
        if (!keypad || !isInCurrentRoom(keypad, game)) {
          return 'There is no keypad here.';
        }
        return 'You see a numeric keypad mounted beside the door. It has buttons numbered 0-9 and appears to be working. Try "use keypad" to attempt entering a code.';
      }

      return performItemAction(noun, command);
    }

    case 'go': {
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

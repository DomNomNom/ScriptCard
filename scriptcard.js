
/*

general terms:
    state:
        the game state.
        makeState() shows the minimal state
        it ideally should be indentical on the server and client

    event:
        A JSON object which must have a .name

        Here are some important fields of a event:
            name        // required.  corresponds to the key for function in state.events.
            id          // generated. should be unique for each event.
            triggered   // generated. keeps track of which triggers this has caused

        It is common for events to have more fields as they can be used in event functions

    event function:
        a function in state.events
        it must take two arguments:
            state:
                the game state
            event:
                the event object containing data for the function
                event.name will be the key for the current function in stack.events
        this function can change state and event

    requirement function:
        a function in state.requirements
        they are simmilar to event functions (take the same arguments) except:
            They are pure functions. (do not modify state)
            return true/false depending on whether the event/action is valid

    action:
        A event caused by a player.
        It has a .player reffering to the player who initiated the action.
        It must have a requirement function which evaluates to true, otherwise it is invalid.


    trigger:
        An event which is in a list within state.triggers.
        A simple example of a definition of state.triggers:
        {
            'pre': {},      // executed when a event happens (when it is about to happen)
            'post': {       // executed when a event just happened
                'turnchange' : [
                    { name: 'drawCard' }
                ]
            }
        }

    stack:
        a stack of events, defining their order of execution
        see applyEvent() for how the stack is used

    cause:
        A event causing a trigger to be put on the stack
        in the trigger example above, 'turnchange' would be a cause

*/

// ====== state creation (only server should do this) ======
// optimization: only send the code that the client needs to the client

function makePlayer(name) {
    return {
        name: name,
        ready: false,
    };
}

// gives the event a new ID
function instantiateEvent(state, event) {
    clone.id = state.nextEventID;
    state.nextEventID += 1;
}


// adds packName if when it does not have a '.' in it
// that way we can add the 'packName.' before 'eventName'
function eventName(name, packName) {
    if (event.indexOf('.') < 0) {
        if (packName) {
            return packName + '.' + name;
        }
        else {
            throw new Error('pack not specified for event: ' + name);
        }
    }
    return name;
}

// third argument is basically optional (see eventName())
function makeEvent(state, eventOrEventName, packName) { // shorthand function
    var event;
    if (typeof event == 'string') {
        event = { name: eventName(eventOrEventName) };
    }
    else if (typeof event == 'object') {
        event = eventOrEventName;
    }
    else {
        throw new TypeError('only strings and objects are valid for argument 2');
    }

    return instantiateEvent(state, event);
}

// instatiates a event and pushes it onto state.stack
// the second argument is passed on to makeEvent
// for external use.
function push(state, event) {
    state.stack.push(makeEvent(state, event));
}

// performs a clone of the event and assigns a new id
function copyEvent(state, event) {
    var clone = JSON.parse(JSON.stringify(event));
    instantiateEvent(state, clone);
    return clone;
}


var matchID = 0;
function makeState() {
    matchID += 1;
    var state = {
        players: [
            makePlayer('Player 1'),
            makePlayer('Player 2')
        ],
        currentPlayer: 0, // player 1
        stack: [],
        matchID: "match"+matchID,
        triggers: {
            pre: {},
            post: {}
        },
        nextEventID: 1,
        playing: true,  // whether the game allows player actions at the moment
        packNames: [],  // this variable comes from server.js

        // not to be transmitted
        requirements: {},
            events: {},
    };
    var setupEvent = makeEvent('base.setup');
    applyEvent(state, setupEvent);
    return state;
}


// this has to be done on the client side as well

function loadPackIntoState(state, pack, packName) {
  // events
  for (var eventName in pack.events) {
    var globalEventName = packName+'.'+eventName;
    if (globalEventName in state.events) {
      console.error('duplicate event name: ' + globalEventName);
      continue;
    }

    // console.log('loading event: ' + globalEventName);
    state.events[globalEventName] = pack.events[eventName];
  }

  // requirements
  for (var eventName in pack.requirements) {
    var globalEventName = packName+'.'+eventName;
    if (!(globalEventName in state.events)) {
        console.warning("requirement without event: " + globalEventName);
    }
    if (globalEventName in state.requirements) {
      console.error('duplicate requirement name: ' + globalEventName);
      continue;
    }

    state.requirements[globalEventName] = pack.requirements[eventName];
  }

  // triggers
  for (var triggerPhase in pack.triggers) {
    if (!(triggerPhase in state.triggers)) {
        state.triggers[triggerPhase] = {};
        console.log('new type of triggerPhase: ' + triggerPhase);
    }
    var statePhase = state.triggers[triggerPhase];

    var phase = pack.triggers[triggerPhase];
    for (var cause in phase) {
        if (!(cause in statePhase)) {
            statePhase[cause] = [];
        }
        var stateTriggers = statePhase[cause];

        var triggers = phase[cause];
        for (var i in triggers) {
            stateTriggers.push(triggers[i]);
        }
    }
  }
}


// ====== state modification ======


// pushes a event that we haven't pushed yet onto the stack
// phase can be 'pre' or 'post'
function pushTrigger(state, event, phase) {
    if (!(phase in state.triggers)) {
        console.error('invalid trigger phase: ' + phase);
        return;
    }

    var triggers = state.triggers[phase][event];
    for (var i in triggers) { // the order of the array defines order
        var trigger = triggers[i];
        if (!(trigger.id in event.triggered)) {
            event.triggered[trigger.id] = true;
            state.stack.push(copyEvent(trigger));
        }
    }
}

// this is the function that gets things rolling
function applyEvent(state, event) {
    var stack = state.stack;
    console.log("applying event: " + event.name);
        if (stack.length != 0)  {
        console.error('stack needs to be emtpy');
        return;
    }
    event = copyEvent(state, event); // ensure it is given a good id

    stack.push(makeEvent(state, 'base.stackEmpty'));
    stack.push(event);

    // while the stack is not empty, try to apply the top if the stack
    // limit the number of times we go through the loop
    var eventInitiator = state.currentPlayer;
    var stackloops;
    for (stackloops=0; stack.length>0 && stackloops<9001; stackloops+=1) {
        var imminentEvent = stack[stack.length-1];  // stack.peek()

        pushTrigger(state, imminentEvent, 'pre'); // push a potential trigger onto the stack

        if (stack && imminentEvent===stack[stack.length-1]) { // are we still imminent?
            stack.pop();
            if (!imminentEvent.name) {
                console.error('imminentEvent without name: ' + JSON.stringify(imminentEvent));
                continue;
            }
            var eventFunction = state.events[imminentEvent.name];
            if (!eventFunction) {
                console.error('could not find eventFunction: ' + imminentEvent.name)
                continue;
            }
            if (!imminentEvent.data) {
                imminentEvent.data = {};
            }

            console.log('executing event: ' + JSON.stringify(imminentEvent))
            eventFunction(state, imminentEvent.data);
        }
    }

    if (stackloops>9000) { // in case we exceeded our limit
        if (eventInitiator) {
            console.log('stack loop too long, initiator looses');
        }
        else {
            console.log('stack loop too long, both loose');
        }
    }
}


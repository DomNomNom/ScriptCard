

/*
general terms:
    state:
        the game state.
        it ideally should be indentical on the server and client
        may be abbreviated to 's'
    event:
        a object that can change the state
        it looks like this:
            {
                name: '[cardName].[eventName]',  // uses to identify a function that can apply this
                data: { ... }
                function: function (state, data) {...}  // not transmitted over sockets
            }
    stack:
        a stack of events, defining their order of execution
*/

// ====== state creation (only server should do this) ======

function makePlayer(name) {
    return { name: 'name' };
}

var matchID = 0;
function makeState() {
    matchID += 1;
    return {
        players: [
            makePlayer('Player 1'),
            makePlayer('Player 2')
        ],
        currentPlayer: 0, // player 1
        stack: [],
        matchID: "match"+matchID,
    };
}

// ====== state modification ======


function imminent(state, event) {
    // TODO: check for interupts
}


function applyEvent(state, event) {
    var stack = state.stack;
    console.log("evet: " + event.name);
    if (!event.function)    { console.error('event without function');   return; }
    if (!event.data)        { console.error('event without data');       return; }
    if (stack.length != 0)  { console.error('stack needs to be emtpy');  return; }

    // while the stack is not empty, try to apply the top if the stack
    // limit the number of times we go through the loop
    stack.push(event);
    var eventInitiator = state.currentPlayer;
    var stackloops;
    for (stackloops=0; stack.length>0 && stackloops<9001; stackloops+=1) {
        var imminentEvent = stack[stack.length-1];

        imminent(state, imminentEvent); // check for interupts

        if (stack && imminentEvent===stack[stack.length-1]) { // are we still imminent?
            stack.pop();
            imminentEvent.function(state, imminentEvent.data);
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


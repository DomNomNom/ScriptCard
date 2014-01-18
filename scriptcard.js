
/*

general terms:
    state:
        the game state.
        makeState() initializes the state (in server.js)
        it ideally should be indentical on the server and client

    event:
        A JSON object which must have a .name

        Here are some important fields of a event:
            name        // required.  corresponds to the key for function in state.events.
            id          // should be unique for each event. instatiateEvent() will set this
            triggered   // keeps track of which triggers this has caused
            cause       // (only if also a trigger) a reference to the event causing the trigger event
            triggerID   // (only if also a trigger) the ID of the trigger

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
        A simple example of a snapshot of state.triggers:
        {
            'pre': {},      // executed when a event happens (when it is about to happen)
            'post': {       // executed when a event just happened
                'turnchange' : [
                    { name: 'drawCard', triggerID: 3 }
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

define(function() {
    return {
        omg: 3, // debug

        // gives the event a new ID
        instantiateEvent: function (state, event) {
            event.id = state.nextEventID || 0;
            state.nextEventID = event.id + 1; // increment nextEventID
            return event;
        },


        // adds packName if when it does not have a '.' in it
        // that way we can add the 'packName.' before 'eventName'
        makeEventName: function (name, packName) {
            if (name.indexOf('.') < 0) {
                if (packName) {
                    return packName + '.' + name;
                }
                else {
                    throw new Error('pack not specified for event: ' + name);
                }
            }

            return name;
        },

        // third argument is basically optional (see makeEventName())
        makeEvent: function (state, eventOrEventName, packName) {
            var event;
            if (typeof eventOrEventName == 'string') {
                event = {
                    name: this.makeEventName(eventOrEventName, packName)
                };
            }
            else if (typeof eventOrEventName == 'object') {
                event = eventOrEventName;
            }
            else {
                throw new TypeError(
                    'only strings and objects are valid for argument 2: ' +
                    eventOrEventName
                );
            }

            return this.instantiateEvent(state, event);
        },

        // instatiates a event and pushes it onto state.stack
        // the second argument is passed on to makeEvent
        // for external use.
        push: function (state, event) {
            state.stack.push(
                this.makeEvent(state, event)
            );
        },

        // performs a clone of the event and assigns a new id
        copyEvent: function (state, event) {
            var clone = JSON.parse(JSON.stringify(event));
            return this.instantiateEvent(state, clone);
        },



        // this has to be done on the client side as well

        loadPackIntoState: function (state, pack, packName) {
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
                    console.warn("requirement without event: " + globalEventName);
                }
                if (globalEventName in state.requirements) {
                    console.error('duplicate requirement name: ' + globalEventName);
                    continue;
                }

                state.requirements[globalEventName] = pack.requirements[eventName];
            }

            // triggers
            for (var phaseName in pack.triggers) {
                if (!(phaseName in state.triggers)) {
                    state.triggers[phaseName] = {};
                    console.log('new type of phaseName: ' + phaseName);
                }
                var statePhase = state.triggers[phaseName];

                var phaseObject = pack.triggers[phaseName];
                for (var causeName in phaseObject) {
                    causeName = this.makeEventName(causeName, packName);
                    if (!(causeName in state.events)) {
                        console.warn('adding triggers for unknown causeName: ' + causeName);
                    }
                    var triggers = phaseObject[causeName];

                    var scriptCard = this;
                    function addTrigger(triggerName) {

                        var trigger = scriptCard.makeEvent(state, triggerName, packName);

                        // sanity check that the event actually exists
                        if (!(trigger.name in state.events)) {
                            console.error('trigger has a unknown event name: ' + trigger.name);
                            return;
                        }

                        scriptCard.applyEvent(
                            state,
                            scriptCard.makeEvent(state, {
                                name: 'base.triggerAdd',
                                trigger: trigger,
                                causeName: causeName,
                                phase:  phaseName
                            })
                        );
                    }

                    // we accept strings and lists of strings as values
                    if (typeof triggers === "string") {
                        addTrigger(triggers); // a single trigger
                    }
                    else if (triggers instanceof Array) {
                        // a list of triggers
                        for (var i in triggers) {
                            if (typeof triggers[i] !== "string") {
                                logging.error('trigger list should be a string or a list of strings but the list contined this: ' + triggers[i]);
                                continue;
                            }
                            addTrigger(triggers[i]);
                        }
                    }
                    else {
                        console.error('['+packName+'] triggers should be a string or a list of strings but you gave this: ' + triggers);
                    }
                }
            }
        },


        // ====== state modification ======

        // pushes a event that we haven't pushed yet onto the stack
        // phase can be 'pre' or 'post'
        // not designed for use outside this module
        pushTrigger: function (state, event, phase) {
            if (!(phase in state.triggers)) {
                console.error('invalid trigger phase: ' + phase);
                return;
            }

            var triggers = state.triggers[phase][event];
            for (var i in triggers) { // the order of the array defines order
                var trigger = triggers[i];
                if (!(trigger.id in event.triggered)) {
                    event.triggered[trigger.id] = true;
                    var triggerEvent = this.copyEvent(trigger);
                    triggerEvent.cause = event;
                    triggerEvent.triggerID = trigger;
                    state.stack.push(triggerEvent);
                }
            }
        },


        // this is the function that gets things rolling
        applyEvent: function (state, event) {
            var stack = state.stack;
            // console.log("applying event: " + event.name);
            if (stack.length != 0)  {
                console.error('stack needs to be emtpy');
                return;
            }
            event = this.instantiateEvent(state, event); // ensure it is given a good id

            stack.push(this.makeEvent(state, 'base.stackEmpty'));
            stack.push(event);

            // while the stack is not empty, try to apply the top if the stack
            // limit the number of times we go through the loop
            var eventInitiator = state.currentPlayer;
            var stackloops;
            for (stackloops=0; stack.length>0 && stackloops<9001; stackloops+=1) {
                var imminentEvent = stack[stack.length-1];  // stack.peek()

                this.pushTrigger(state, imminentEvent, 'pre'); // push a potential trigger onto the stack

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

                    if (imminentEvent.name != 'base.stackEmpty') {
                        console.log(
                            'executing event: ' +
                            JSON.stringify(imminentEvent)
                        );
                    }
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
        },


    } // return {}
});

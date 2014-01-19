
/*

general terms:
    state:
        the game state.
        makeState() initializes the state (in server.js)
        it ideally should be indentical on the server and client

    event:
        A JSON object which must have a .name correspoinding to a key in state.events

        Here are some important fields of a event:
            name        // required.  corresponds to the key for function in state.events.
            id          // should be unique for each event. instatiateEvent() will set this
            triggered   // keeps track of which triggers this has caused
            cause       // (only if it is a trigger-caused event) a reference to the event causing the trigger

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
                    { name: 'drawCard', id: 3 }
                ]
            }
        }
        in this example, after the cause ('turnchange') occurs,
        the trigger (drawCard object) is deep-copied and pushed on the stack

    stack:
        a stack of events, defining their order of execution
        see applyEvent() for how the stack is used

    cause:
        A event causing a trigger to be put on the stack
        in the trigger example above, 'turnchange' would be a cause

*/

// ====== state creation (only server should do this) ======
// optimization: only send the code that the client needs to the client

define(['jsonStringify.js'], function(jsonStringify) {
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

        // performs a deep-copy the event of the event and assigns a new id
        copyEvent: function (state, event) {
            if (!state || !event) {
                throw new Error('copyEvent requires all arguments.');
            }
            // console.log('omg: ' + JSON.stringify(event));
            // for (var key in event) {
            //     console.log('   ' + key + ": " + event[key]);
            // }

            // var clone = jsonStringify.toObject(jsonStringify.make(event));
            var clone = JSON.parse(JSON.stringify(event));
            return this.instantiateEvent(state, clone);
        },



        // this has to be done on the client side as well

        loadPacksIntoState: function (state, packs) {
            function error(pack, message) {
                console.error('error loading ' + pack.name + ': ' + message);
            }

            // sanity check that all packs have a .name
            for (var i in packs) {
                if (!packs[i].name) {
                    console.error('All packs must have a .name; packs['+i+'] doesnt.');
                    return;
                }
            }

            // events
            packs.forEach(function loadEvents(pack) {
                for (var eventName in pack.events) {
                    var globalEventName = pack.name+'.'+eventName;
                    if (globalEventName in state.events) {
                        error(pack, 'duplicate event name: ' + globalEventName);
                        continue;
                    }

                    // console.log('loading event: ' + globalEventName);
                    state.events[globalEventName] = pack.events[eventName];
                }
            });

            // requirements
            packs.forEach(function loadRequirements(pack) {
                for (var eventName in pack.requirements) {
                    var globalEventName = pack.name+'.'+eventName;
                    if (!(globalEventName in state.events)) {
                        error(pack, 'requirement without event: ' + globalEventName);
                        continue;
                    }
                    if (globalEventName in state.requirements) {
                        error(pack, 'duplicate requirement name: ' + globalEventName);
                        continue;
                    }

                    state.requirements[globalEventName] = pack.requirements[eventName];
                }
            });

            // triggers
            var scriptCard = this;
            packs.forEach(function loadtriggers(pack) {

                for (var phaseName in pack.triggers) {
                    if (!(phaseName in state.triggers)) {
                        state.triggers[phaseName] = {};
                        console.log('new type of phaseName: ' + phaseName);
                    }
                    var statePhase = state.triggers[phaseName];

                    var phaseObject = pack.triggers[phaseName];
                    for (var causeName in phaseObject) {
                        causeName = scriptCard.makeEventName(causeName, pack.name);
                        if (!(causeName in state.events)) {
                            error(pack, 'adding triggers for unknown causeName: ' + causeName);
                        }
                        var triggers = phaseObject[causeName];

                        function addTrigger(triggerName) {

                            var trigger = scriptCard.makeEvent(state, triggerName, pack.name);

                            // sanity check that the event actually exists
                            if (!(trigger.name in state.events)) {
                                error(pack, 'trigger has a unknown event name: ' + trigger.name);
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
                                    error(pack, 'trigger list should be a string or a list of strings but the list contined this: ' + triggers[i]);
                                    continue;
                                }
                                addTrigger(triggers[i]);
                            }
                        }
                        else {
                            error(pack, 'triggers should be a string or a list of strings but you gave this: ' + triggers);
                        }
                    }
                }
            });
        }, // end loadPacksIntoState


        // ====== state modification ======

        // pushes a event that we haven't pushed yet onto the stack
        // phase can be 'pre' or 'post'
        // not designed for use outside this module
        pushTrigger: function (state, event, phase) {
            if (!(phase in state.triggers)) {
                console.error('invalid trigger phase: ' + phase);
                return;
            }

            var triggers = state.triggers[phase][event.name];
            for (var i in triggers) { // the order of the array defines order
                var trigger = triggers[i];
                if (!event.triggered) {
                    event.triggered = {};
                }
                if (!(trigger.id in event.triggered)) {
                    var triggerEvent = this.copyEvent(state, trigger);
                    triggerEvent.cause = event;
                    // triggerEvent.triggerID = trigger;
                    event.triggered[trigger.id] = triggerEvent;
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

                    if (imminentEvent.name != 'base.stackEmpty') {
                        // console.log('aaa ' + jsonStringify imminentEvent);
                        // console.log('boop')
                        // for (var k in imminentEvent.cause) {
                        //         console.log('   ' + k + ': ' + imminentEvent.cause[k])
                        // }
                        console.log(
                            'executing event: ' +
                            this.debugEvent(imminentEvent)
                        );
                    }
                    eventFunction(state, imminentEvent);
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

        // stringifies a event to a human-readable string
        // avoids bugs with circular references by only going 1 layer deep
        debugEvent: function(event) {
            var values = []
            for (var key in event) {
                values.push(key + ': ' + event[key])
            }
            return '{ ' + values.join(', ') + ' }';
        }
    } // return {}
});

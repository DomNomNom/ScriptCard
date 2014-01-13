// this pack is required as it defines important events such as setup
define(['scriptcard.js'], function(scriptCard) {
    function doNothing(state, event) { }

    function setPlaying(playing) {
        // here we actually return a event function given
        // what we should set state.playing to
        return function setPlaying2(state, event) {
            state.playing = playing;
        }
    }

    return {
        events: {
            // these event functions exist to allow for triggers
            setup:  doNothing,  // right after state is created. only on server.
            gameStart:  setPlaying(true ),  // causes the first turn to occur
            gameEnd:    setPlaying(false),  // causes the game to end
            stackEmpty: doNothing,  // starts off at the bottom of the stack

            // ====== trigger registration events ======

            // registers a trigger to happen from here on
            // phase is optional and defaults to 'pre'
            triggerAdd: function (state, event) {
                var trigger     = event.trigger;
                var causeName   = event.causeName;
                var phase       = event.phase;

                // verify phase
                if (typeof phase === 'undefined') {  phase = 'pre';  }
                if (!(phase in state.triggers)) {
                    throw new Error('triggerOnce got an invalid phase: ' + phase);
                }

                var phaseTriggers = state.triggers[phase];
                var triggerList;
                if (causeName in phaseTriggers) {
                    triggerList = phaseTriggers[causeName];
                }
                else {
                    triggerList = phaseTriggers[causeName] = [];
                }
                triggerList.push(trigger);  // TODO: priorities

            },

            // registers a trigger to happen at most once from here on
            // this is done by making a wrapping trigger such that
            //      the given trigger is put on the stack
            //      the wrapper is gets removed from the trigger list
            // arguments are the same as for scriptcard.trigger()
            triggerOnce: function (state, event) {
                var trigger     = event.trigger;
                var causeName   = event.causeName;
                var phase       = event.phase;

                // veryfy phase
                if (typeof phase === 'undefined') {  phase = 'pre';  }
                if (!(phase in state.triggers)) {
                    throw new Error('triggerOnce got an invalid phase: ' + phase);
                }

                var wrappingTrigger = {
                    name: 'base.triggerOnceWrapper',
                    trigger:    trigger,
                    causeName:  causeName,
                    phase:      phase,
                };

                // push a event that puts the wrapping trigger into the trigger list
                scriptCard.push(state, {
                    name: 'base.triggerAdd',
                    trigger: wrappingTrigger,
                    causeName: causeName,
                    phase: phase,
                });
            },

            // this is used by triggerOnce
            triggerOnceWrapper: function (state, event) {
                scriptCard.push(state, event.wrapTrigger);
                scriptCard.push(state, {
                    name: 'base.triggerRemove',
                    triggerID:  event.triggerID,
                    causeName:  event.wrapCauseName,
                    phase:      event.wrapPhase
                });
            },

            //
            triggerRemove: function (state, event) {
                var triggerID = event.triggerID;
                var causeName = event.causeName;
                var phase     = event.phase;

                // verify phase
                if (typeof phase === 'undefined') {  phase = 'pre';  }
                if (!(phase in state.triggers)) {
                    throw new Error('triggerOnce got an invalid phase: ' + phase);
                }

                var phaseDict = state.triggers[phase];
                if (!(causeName in phaseDict)) {
                    return;
                }

                phaseDict[causeName] = phaseDict[causeName].filter(function (trigger) {
                    return trigger.id != triggerID
                });

            }


        },

    };
})

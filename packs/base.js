// this pack is required as it defines important events such as setup

function makePack() {
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
        },

    };
}
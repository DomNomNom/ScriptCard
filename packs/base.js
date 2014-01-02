// this pack is required as it defines important events such as stackEmpty

function doNothing(state, event) { }

function setPlaying(playing) {
    // here we actually return a event function given
    // what we should set state.playing to
    return function setPlaying2(state, event) {
        state.playing = playing;
    }
}


function makePack(){
    return {
        events: {
            // these three event functions only exist to allow for triggers
            gameSetup:  doNothing,  // before the game starts
            gameStart:  setPlaying(true ),  // causes the first turn to occur
            gameEnd:    setPlaying(false),  // causes the game to end
            stackEmpty: doNothing,  // starts off at the bottom of the stack
        },

    };
}

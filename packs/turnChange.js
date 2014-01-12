define(['scriptcard.js'], function (scriptCard) {

    return {
        events: {
            turnChange: function (state, event) {
                event.oldPlayer = state.currentPlayer;
                state.currentPlayer = (state.currentPlayer+1) % state.players.length;
                event.newPlayer = state.currentPlayer;

                // make turnStart
                state.triggers.pre['base.stackEmpty']
            },
            turnStart: function (state, event) { }
        },
        requirements: {
            turnChange: function (state, event) {
                // we're in a valid state and
                // we can only end turns, not force begin
                return (
                    state.currentPlayer in state.players &&
                    state.players[state.currentPlayer] === event.player
                );
            }
        }
    }
});

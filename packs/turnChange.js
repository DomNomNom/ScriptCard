function makePack() {
    return {
        events: {
            turnChange: function (state, event) {
                state.currentPlayer = (state.currentPlayer+1) % state.players.length;
            }
        },
        requirements: {
            turnChange: function (state, event) {
                // we're in a valid state and
                // we can only end turns, not force begin
                return (
                    state.currentPlayer in state.players &&
                    state.players[state.currentPlayer] === data.player
                );
            }
        }
    }
}

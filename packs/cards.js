function makePack(){
    return {
        cards: [],
        events: {
            drawCard: function (state, data) {
                console.log("drawCard!");
                // state.player.hand.append(state.player.deck.pop())
            }
        },
        triggers: {
            'pre': {},
            'post': {
                'turnstart' : { name: 'drawCard' }
            },
        }
    };
}

define(['scriptcard.js'], function (scriptCard) {
    return {
        events: {
            setup: function (state, event) {
                for (var i in state.players) {
                    scriptCard.push(state, {
                        name: 'playerHealth.setHealth',
                        targetHealth: 30,
                        playerIndex: i
                    })
                }
            },
            setHealth: function (state, event) {
                state.players[event.playerIndex].health = event.targetHealth;
            },
            takeDamadge: function (state, event) {
                var playerHealth = state.players[event.playerIndex].health;
                scriptCard.push({
                    name: 'playerHealth.setHealth',
                    targetHealth: playerHealth - amount.damadge,
                });
            }
        },
        triggers: {
            'pre': {
                'base.setup': 'setup',
            }
        }
    };
})

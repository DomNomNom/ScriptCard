define(['scriptcard.js'], function (scriptCard) {
    return {
        cards: [],
        events: {
            consolelog: function (state, event) {
                console.log(
                    'consolelog: ' +
                    scriptCard.debugEvent(event)
                );
            }
        },
        triggers: {
            pre: {
                'base.setup': 'consolelog.consolelog',
            }
        }
    }
});

define({
    cards: [],
    events: {
        consolelog: function (state, data) {
            console.log("consolelog: " + JSON.stringify(data));
        }
    },
    triggers: {
        pre: {
            'gameSetup': { name: 'consolelog.consolelog' }
        }
    }
});

function makePack(){
    return {
        cards: [],
        events: {
            consolelog: function (state, data) {
                console.log("omg consolelog event!");
            }
        },
        triggers: {}
    };
}
